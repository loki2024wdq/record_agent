from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app" / "assets"


def get_font(size):
    candidates = [
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/seguiemj.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def rounded_rectangle(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def create_icon(size, maskable=False):
    image = Image.new("RGBA", (size, size), "#00000000")
    draw = ImageDraw.Draw(image)
    margin = 0 if maskable else int(size * 0.055)
    radius = int(size * (0.2 if maskable else 0.18))

    rounded_rectangle(
        draw,
        (margin, margin, size - margin, size - margin),
        radius,
        "#2f6f50",
    )

    safe = int(size * (0.19 if maskable else 0.12))
    hill_y = int(size * 0.69)
    draw.polygon(
        [
            (safe, hill_y),
            (int(size * 0.42), int(size * 0.34)),
            (int(size * 0.55), int(size * 0.62)),
            (int(size * 0.66), int(size * 0.44)),
            (size - safe, hill_y),
        ],
        fill="#d9f0e1",
    )
    draw.ellipse(
        (
            int(size * 0.66),
            int(size * 0.21),
            int(size * 0.82),
            int(size * 0.37),
        ),
        fill="#f6f9f6",
    )

    line_width = max(8, int(size * 0.045))
    draw.line(
        (
            int(size * 0.24),
            int(size * 0.75),
            int(size * 0.76),
            int(size * 0.75),
        ),
        fill="#f6f9f6",
        width=line_width,
    )
    draw.line(
        (
            int(size * 0.25),
            int(size * 0.25),
            int(size * 0.55),
            int(size * 0.25),
        ),
        fill="#f6f9f6",
        width=line_width,
    )

    font = get_font(int(size * 0.16))
    text = "3D"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    draw.text(
        (int(size * 0.25), int(size * 0.36)),
        text,
        fill="#ffffff",
        font=font,
        stroke_width=max(1, int(size * 0.006)),
        stroke_fill="#214f3b",
    )

    return image


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    outputs = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-512.png", 512, True),
        ("apple-touch-icon.png", 180, False),
    ]
    for name, size, maskable in outputs:
        create_icon(size, maskable).save(ASSETS / name)
    print("Generated PWA icons:")
    for name, _, _ in outputs:
        print(f"- {ASSETS / name}")


if __name__ == "__main__":
    main()
