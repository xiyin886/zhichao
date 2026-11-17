from PIL import Image, ImageFilter
import numpy as np

# 打开透明底完整人物，位置完全不动
full_img = Image.open("/home/user/zhichao/live2d/layers/00-character-full.png").convert("RGBA")
width, height = full_img.size
data = np.array(full_img)

# 识别烟粉色头发像素，颜色范围严格匹配原图发色
r, g, b, a = data.T
hair_color_mask = (r > 170) & (g > 130) & (b > 150) & (r > g+10) & (g > b+5) & (a > 0)

# 坐标mask：只取后发区域，排除刘海、脸侧前发
y_grid, x_grid = np.mgrid[0:height, 0:width]
center_x = width // 2
# 后发：y在头顶以下，身体两侧+后方，排除脸前侧的刘海和前发（y小于0.3高度且靠近中心的是刘海，去掉）
back_region_mask = (
    (y_grid > height * 0.12)
    & (y_grid < height * 0.72)
    & (
        # 两侧垂落的长发
        (np.abs(x_grid - center_x) > width * 0.13)
        # 头顶后方的头发，排除前侧刘海（中心区域y>0.25才保留）
        | ((np.abs(x_grid - center_x) <= width * 0.13) & (y_grid > height * 0.26))
    )
)

final_mask = hair_color_mask & back_region_mask
# 生成后发图层，其他区域全透明
back_hair_data = np.zeros_like(data)
back_hair_data[final_mask] = data[final_mask]
back_hair_img = Image.fromarray(back_hair_data)

# 只对alpha通道做轻微高斯模糊，柔化边缘，不改动形状和颜色
alpha = back_hair_img.split()[-1].filter(ImageFilter.GaussianBlur(radius=1.2))
back_hair_img.putalpha(alpha)

# 保存后发层
back_hair_img.save("/home/user/zhichao/live2d/layers/01-back-hair.png")
print("精准后发层已生成，位置完全对齐原图")
