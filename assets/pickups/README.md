# 補給道具圖示

以 Codex 內建 `image_gen.imagegen` 生成單張 low-poly 軍事街機圖集，未使用 CLI/API。三格依左至右為維修、無人機、追蹤飛彈；輸出是 RGBA 真透明圖，已目視檢查。

- 原圖：`pickup-sheet.png`，2172 × 724，保留生成原檔。
- `repair.png`：原圖矩形 (0, 0, 724, 724)。
- `drone.png`：原圖矩形 (724, 0, 1448, 724)。
- `missile.png`：原圖矩形 (1448, 0, 2172, 724)。
- 裁切座標採 Pillow 左、上、右、下格式，右／下不包含；每格以 Lanczos 縮為 256 × 256 PNG，保留 alpha，未重畫圖案。
- 來源：`/home/john/.codex/generated_images/01a0e2cb-f016-74b0-9141-6dade55accea/exec-88e98785-de16-4127-b47c-ca4d93665e9d.png`。

## 生成提示

```text
Use case: stylized-concept. Asset type: one production sprite sheet for three pickups in a top-down 3D military arcade tank game.
Create one wide horizontal 3:1 image, ideally 1536 x 512 pixels, divided into exactly THREE EQUAL SQUARE CELLS edge-to-edge in a single row. Each cell has the SAME completely flat solid deep navy background (#101e2b), no dividers or card borders. All icons centered at 1/6, 1/2 and 5/6 of canvas width, with equal scale and at least 16% empty padding inside each cell. Nothing may cross a cell boundary.
LEFT CELL: a chunky mint-green repair/medical supply case, a strong white wrench plus a small white medical cross, slight low-poly isometric front/top view. MIDDLE CELL: a bold cyan four-rotor quadcopter drone seen directly from above, four obvious circular propeller housings and compact central body. RIGHT CELL: exactly TWO chunky amber-yellow guided missiles next to each other, both pointed upward, visible pointed noses and wide angular tail fins, one slightly taller.
Style: polished low-poly toy military arcade inventory icons, thick clear silhouettes, bright solid colors, simple beveled geometric forms, restrained soft shading, high contrast against navy, readable when each cell shrinks to 48px. Uniform visual weight. No tiny texture, no landscape, no extra items, no shadow extending outside icons, no text, no labels, no letters, no numerals, no watermarks. Output just the single finished three-cell sprite sheet.
```
