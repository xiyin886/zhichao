from PIL import Image
import numpy as np

# 打开透明底完整人物
full_img = Image.open("/home/user/zhichao/live2d/layers/00-character-full.png").convert("RGBA")
width, height = full_img.size
data = np.array(full_img)

# 初始化后发图层：只保留后发区域（肩膀后方、身体两侧的长发，排除前发刘海、身体、衣服）
back_hair = np.zeros_like(data)
# 后发区域坐标：y从头顶到裙摆上方，x在身体两侧，且属于烟粉色头发区域
# 识别烟粉色头发的颜色范围
r, g, b, a = data.T
hair_mask = (r > 180) & (g > 140) & (b > 160) & (r > g) & (g > b) & (a > 0)

# 只取身体后侧/两侧的头发，排除前侧刘海和脸边前发
y_grid, x_grid = np.mgrid[0:height, 0:width]
# 身体中心x范围，后发在身体两侧和后方
center_x = width // 2
back_hair_mask = hair_mask & (
    (y_grid > height*0.1) & (y_grid < height*0.7)
    & ((np.abs(x_grid - center_x) > width*0.12) | (y_grid > height*0.35))
)

back_hair[back_hair_mask] = data[back_hair_mask]
Image.fromarray(back_hair).save("/home/user/zhichao/live2d/layers/01-back-hair.png")
print("后发图层已生成")
