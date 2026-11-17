from PIL import Image
import numpy as np

# 打开定稿图片
img = Image.open("/home/user/zhichao/live2d/source/xiyin-artwork-complete.png").convert("RGBA")
data = np.array(img)

# 分离RGB通道
r, g, b, a = data.T
# 识别接近白色的背景（保留柔和阴影，阈值设置合理，避免把白裙误判）
white_threshold = 240
background_mask = (r >= white_threshold) & (g >= white_threshold) & (b >= white_threshold)
# 背景区域alpha设为0，其他区域保留，边缘做自然过渡
data[..., 3][background_mask.T] = 0

# 处理边缘半透明，避免硬边
transparent_img = Image.fromarray(data)
# 保存透明底完整人物
transparent_img.save("/home/user/zhichao/live2d/layers/00-character-full.png")
print("透明底人物已生成")
