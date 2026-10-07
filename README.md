# Word Island — Đảo Từ Vựng

Game học từ vựng tiếng Anh cho trẻ em, chạy **offline**. Mọi hình ảnh do Game Asset Studio (app sinh asset chạy local, repo riêng) sinh bằng OpenAI GPT Image; phát âm do OpenAI TTS đọc sẵn thành mp3.

## Chơi

Mở `game\index.html` bằng Chrome / Edge (bấm đúp). Không cần mạng, không cần cài gì.
Muốn chép sang máy khác: copy nguyên thư mục `game\`.

- 6 hòn đảo (chủ đề): Animals, Fruits, Food, School, Home, Transport — mỗi đảo 8 từ.
- **Vượt ải** (từ v1.1): mỗi đảo là một bản đồ 8 ải + 1 ải boss.
  - Ải sau mở khi ải trước được ≥ 1 sao; đảo sau mở khi đánh bại boss đảo trước.
  - Mỗi ải có **3 trái tim**; trả lời sai mất 1 tim, hết tim thì chơi lại ải (không phải chờ). Sao = số tim còn lại.
  - Độ khó tăng dần: làm quen 3 từ mới → chọn hình/chọn từ → **Bóng bay** (bắn bóng có chữ đúng, có giới hạn giờ) → **Chữ bị mất** → **Nhanh tay** (đúng/sai trong 30 giây) → **Đánh vần** → **Bóng bay siêu tốc**. Các ải sau luôn trộn từ của ải trước để ôn lại.
  - **Ải boss**: 10 câu trộn trong 2 phút; thắng → mở rương → nhận một chiếc mũ cho cú Ollie (xem ở *Tủ mũ*).
- **Tìm đồ vật** (từ v1.2, nút dưới bản đồ đảo): 8 đồ vật của đảo + vài đồ vật "gây nhiễu" của đảo khác được rải ngẫu nhiên lên tranh nền của đảo — mỗi lần chơi một kiểu. Ollie hỏi "Can you find the lamp?", bé chạm đúng đồ vật. Sao theo số lần chạm nhầm, có lưu kỷ lục thời gian. Sau 10 giây chưa tìm ra, đồ vật cần tìm sẽ lắc lư gợi ý. Ải 6 và ải boss cũng có lượt tìm đồ vật.
- **Luyện tập tự do** (nút dưới bản đồ đảo): 4 trò của bản 1.0 — Học từ mới (thẻ hình + câu ví dụ), Nghe và chọn, Nhìn và chọn, Đánh vần.
- Tiến độ lưu trong máy. Bản 1.0 → 1.1: đảo đã chơi tự mở, số sao cũ được tính thành số ải đã qua.
- Bàn phím (máy tính): ← → lật thẻ, phím cách = nghe lại, 1–4 chọn đáp án, gõ chữ để đánh vần, Backspace xoá, Enter = ải tiếp theo.

## Cài trên máy tính bảng Android (APK)

File cài: `dist\WordIsland-1.2.apk` (~9 MB, Android 7 trở lên, không xin quyền gì, không cần mạng). Cài đè lên bản cũ được, giữ nguyên tiến độ.

**Cách 1 — không cần dây:** gửi file APK sang máy tính bảng (Zalo, Telegram, Google Drive, hoặc chép qua USB) → mở file → cho phép "Cài ứng dụng không rõ nguồn gốc" cho app vừa mở file → **Cài đặt**. Nếu Play Protect cảnh báo "nhà phát triển không xác định": *Chi tiết* → *Vẫn cài đặt*.

**Cách 2 — cắm USB:** trên máy tính bảng bật *Tuỳ chọn nhà phát triển* (Cài đặt → Thông tin máy → bấm *Số hiệu bản dựng* 7 lần) → bật *Gỡ lỗi USB* → cắm dây vào máy tính rồi chạy:

```powershell
.\android\build-apk.ps1 -Install
```

**Build lại sau khi sửa game:** `.\android\build-apk.ps1` (APK lấy thẳng thư mục `game\`, không cần chép). Muốn cài đè lên bản cũ mà **giữ nguyên sao của bé**: tăng `versionCode` / `versionName` trong `android\app\build.gradle`, build, cài đè.

> **Sao lưu `android\keystore\` và `android\keystore.properties`** (chìa khoá ký APK, không nằm trong git). Mất chúng thì bản mới không cài đè được — phải gỡ app cũ, mất tiến độ.

Trong app: nút Back của Android = nút ← trong game; ở màn hình chính thì thoát app. App chạy toàn màn hình, giữ màn hình sáng khi đang chơi, tắt tiếng khi chuyển sang app khác.

## Sửa nội dung / sinh lại ảnh

Nội dung nằm ở `content\words.json` (từ, nghĩa, câu ví dụ, mô tả ảnh). Game Asset Studio phải đang chạy (`D:\code\game-asset-studio\run.ps1`).

```powershell
$py = 'D:\code\game-asset-studio\.venv\Scripts\python.exe'
& $py tools\assets.py words                    # sinh ảnh cho từ mới thêm vào words.json
& $py tools\assets.py words --redo cat,lamp    # vẽ lại ảnh chưa ưng
& $py tools\assets.py mascot --redo happy      # vẽ lại 1 biểu cảm của cú Ollie
& $py tools\assets.py backgrounds --redo food
& $py tools\assets.py extras                   # boss (+ dáng bị hạ), mũ, rương — --redo boss:food,hat:home,chest
& $py tools\assets.py sheet                    # ảnh xem nhanh trong build\ để duyệt
& $py tools\audio.py                           # phát âm cho từ / câu mới
& $py tools\assets.py export                   # chép ảnh vào game\ + viết lại game\data.js
```

Ảnh được duyệt sẵn trong Game Asset Studio (tab Studio → lọc "Đã duyệt", style "Word Island"), có thể chỉnh hậu xử lý ở đó rồi chạy lại `export`.

`tools\asset_map.json` ghi từ nào dùng asset số mấy trong studio. Script dừng nếu tổng chi tiêu của studio vượt `MAX_SPEND` (mặc định $4.5).

## Cấu trúc

```
game/                 thứ đem đi chơi
  index.html, style.css
  game.js             màn hình chính, bản đồ đảo, tủ mũ, luyện tập tự do
  levels.js           chế độ vượt ải: các loại câu hỏi, trái tim, boss, phần thưởng
  find.js             tìm đồ vật trong tranh (dùng riêng + làm 1 loại lượt trong ải)
  data.js             sinh tự động từ content/words.json
  assets/img/         ảnh WebP (từ, cú Ollie, nền)
  assets/audio/       mp3 phát âm
  assets/fonts/       Baloo 2 (SIL Open Font License)
content/words.json    nội dung
android/              app Android (WebView toàn màn hình) + build-apk.ps1
dist/                 APK đã build
tools/                assets.py (gọi Game Asset Studio), audio.py (TTS), fetch_font.py, make_icons.py
docs/design.md        quyết định thiết kế
```
