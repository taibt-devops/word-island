# Word Island — game học từ vựng tiếng Anh (offline)

Ngày 2026-10-07. Mọi hình ảnh sinh qua **Game Asset Studio** (`http://127.0.0.1:8765`, OpenAI GPT Image).

## Mục tiêu

Trẻ em Việt Nam / người mới bắt đầu học từ vựng tiếng Anh qua hình ảnh + phát âm. Không cần mạng, không cần cài đặt: mở `game/index.html` là chơi.
Thành công khi: đứa trẻ tự chơi được (hướng dẫn tiếng Việt, nút to), nghe được phát âm chuẩn, thấy tiến bộ (sao), và hình ảnh đẹp, đồng nhất một phong cách.

## Quyết định (tự chọn — có thể lật lại)

| # | Quyết định | Lý do |
|---|---|---|
| G1 | Đối tượng: trẻ 5–10 tuổi / người mới học; giao diện tiếng Việt, nội dung tiếng Anh | Học từ qua hình là cách hợp nhất với ảnh AI |
| G2 | 6 chủ đề × 8 từ = 48 từ; mỗi từ có nghĩa tiếng Việt + 1 câu ví dụ ngắn | Đủ để chơi nhiều buổi; chi phí ảnh ~ $1–2 |
| G3 | 4 chế độ: Học (thẻ hình) · Nghe & chọn hình · Nhìn & chọn từ · Đánh vần | Đi từ nhận biết → nhớ → viết |
| G4 | Sao: mỗi chế độ chơi 1–3 sao theo điểm cao nhất; lưu tiến độ trong `localStorage` | Động lực, không cần tài khoản |
| G5 | HTML/CSS/JS thuần, chạy từ `file://`: dữ liệu nhúng trong `data.js` (không `fetch`), font tự đóng gói, không CDN | `fetch` bị chặn trên `file://`; offline thật |
| G6 | Ảnh: 1 style riêng "Word Island" + 1 ảnh mốc (quả táo) làm tham chiếu style cho mọi ảnh sau; xuất WebP | Đồng nhất nét vẽ; WebP nhỏ (~50 KB/ảnh) |
| G7 | Linh vật "Cú Ollie" — 1 ảnh gốc + 3 biểu cảm sinh bằng chức năng *sửa ảnh* (giữ nguyên nhân vật) | Phản hồi đúng/sai sinh động |
| G8 | Phát âm: file mp3 sinh trước bằng OpenAI TTS (`gpt-4o-mini-tts`, giọng cô giáo chậm rõ); thiếu file thì dùng giọng đọc của trình duyệt | Offline, đồng nhất trên mọi máy |
| G9 | Hiệu ứng âm thanh tổng hợp bằng WebAudio | Không cần file, không bản quyền |
| G10 | Ngân sách ảnh ≤ $4 (dừng lại hỏi nếu vượt) | Key dùng chung với dự án khác |

## v1.1 — Vượt ải (giai đoạn 1, 2026-10-07)

| # | Quyết định | Lý do |
|---|---|---|
| V1 | Mỗi đảo = 8 ải + 1 ải boss (54 ải). Ải k+1 mở khi ải k được ≥ 1 sao; đảo sau mở khi thắng boss đảo trước | Tiến độ rõ ràng, luôn có "ải tiếp theo" |
| V2 | 3 trái tim mỗi ải; sai = mất 1 tim; hết tim = chơi lại ngay (không chờ, không năng lượng) | Có thử thách nhưng không bẫy giữ chân |
| V3 | Sao ải = số tim còn lại khi qua ải | Một luật duy nhất, trẻ hiểu ngay |
| V4 | Câu chọn hình/chọn từ/điền chữ/ghép cặp: sai thì loại đáp án đó và chọn tiếp (vẫn mất tim) | Bé luôn tìm ra đáp án đúng → nhớ từ |
| V5 | Độ khó tăng dần trong đảo: 3 từ mới/ải đầu với 2–3 đáp án → 4 đáp án → điền chữ → đánh vần có chữ nhiễu; ải sau luôn trộn từ của ải trước (ôn lại) | Học theo bậc + lặp lại có khoảng cách |
| V6 | Trò mới: **Bóng bay** (bắn bóng có chữ đúng đang bay lên, có giới hạn giờ), **Nhanh tay** (đúng/sai trong 30 giây), **Ghép cặp**, **Đúng hay sai**, **Điền chữ còn thiếu** | Đa dạng nhịp chơi; đếm giờ theo yêu cầu |
| V7 | Ải boss: 10 câu trộn, đồng hồ 120 giây, mỗi câu đúng trừ máu boss; thắng → mở rương → nhận 1 chiếc mũ cho cú Ollie | Cao trào cuối đảo + phần thưởng nhìn thấy được |
| V8 | Bản đồ ải vẽ bằng SVG trên ảnh nền đảo có sẵn (không sinh ảnh bản đồ mới) | Rẻ, co giãn mọi màn hình |
| V9 | 4 trò luyện tập cũ giữ lại trong nút "Luyện tập" của mỗi đảo đã mở | Ôn tự do, không mất tính năng cũ |
| V10 | Tiến độ v1.0 được chuyển: đảo đã chơi → mở, số ải đã qua = số sao cũ (tối đa 8) | Bé không phải chơi lại từ đầu |
| V11 | Asset mới qua Game Asset Studio: 6 boss + 6 dáng "bị hạ", 6 mũ (đặt chồng lên Ollie bằng CSS), rương đóng/mở | ~20 ảnh, < $1 |

## Cấu trúc

```
content/words.json     nguồn nội dung: chủ đề, từ, nghĩa, câu, mô tả ảnh
tools/assets.py        gọi Game Asset Studio API: style, ảnh từ, linh vật, nền, xuất sang game/
tools/audio.py         sinh mp3 phát âm (OpenAI TTS)
game/                  THỨ ĐEM ĐI: index.html, style.css, game.js, data.js, assets/
```
