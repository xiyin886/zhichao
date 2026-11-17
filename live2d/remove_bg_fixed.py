from PIL import Image, ImageDraw
import numpy as np

# 打开原始定稿，不使用之前的错误结果
img = Image.open("/home/user/zhichao/live2d/source/xiyin-artwork-complete.png").convert("RGBA")
width, height = img.size
pixels = img.load()

# 标记背景：从四个角开始漫水填充，只处理和边缘连通的白色
visited = np.zeros((height, width), dtype=bool)
queue = []

# 加入四个角作为起点
corners = [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1)]
for x, y in corners:
    r, g, b, a = pixels[x, y]
    if r >= 235 and g >= 235 and b >= 235:
        queue.append((x, y))
        visited[y, x] = True

# 四方向漫水，容差15，只找连通的白色背景
threshold = 20
while queue:
    x, y = queue.pop(0)
    for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
        nx, ny = x+dx, y+dy
        if 0 <= nx < width and 0 <= ny < height and not visited[ny, nx]:
            r, g, b, a = pixels[nx, ny]
            if r >= 235-threshold and g >= 235-threshold and b >= 235-threshold:
                visited[ny, nx] = True
                queue.append((nx, ny))

# 把识别到的背景区域alpha设为0，其他区域完全保留，包括内部白裙
data = np.array(img)
data[visited, 3] = 0
fixed_img = Image.fromarray(data)

# 覆盖修正后的透明底文件
fixed_img.save("/home/user/zhichao/live2d/layers/00-character-full.png")
print("修正完成，内部白裙已完整保留")
