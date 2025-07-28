from PIL import Image, ImageDraw
import os

def create_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    linkedin_blue = (0, 115, 177, 255)
    white = (255, 255, 255, 255)
    
    margin = 2
    draw.ellipse([margin, margin, size-margin, size-margin], fill=linkedin_blue)
    
    if size >= 32:
        text_size = size // 4
        draw.rectangle([size//4, size//3, size//4 + text_size//3, size//3 + text_size], fill=white)
        draw.rectangle([size//2, size//3, size//2 + text_size//3, size//3 + text_size], fill=white)
        draw.rectangle([size//2, size//2, size//2 + text_size, size//2 + text_size//3], fill=white)
    else:
        center = size // 2
        draw.rectangle([center-3, center-3, center+3, center+3], fill=white)
    
    return img

sizes = [16, 32, 48, 128]
for size in sizes:
    icon = create_icon(size)
    icon.save(f'icon{size}.png')
    print(f'Created icon{size}.png')
