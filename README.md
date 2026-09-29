# Xưởng Kinh Dị

Trình dựng trang mời Có/Không, lưu mẫu và tạo liên kết share có nền tùy chỉnh, con trỏ emoji/ảnh và video hoặc GIF.

## Cách dùng

1. Chạy `server.py` theo phần “Mở thử nhanh”, rồi mở `http://localhost:8000/`.
2. Tùy chỉnh hộp thoại, tải ảnh/video/GIF lên và lưu mẫu nếu muốn dùng lại.
3. Tạo liên kết ngắn dạng `http://localhost:8000/s/AbC1234` rồi gửi cho người nhận.

Khi chạy trên GitHub Pages, nền tảng không có API/SQLite nên nút tạo liên kết sẽ tự dùng dạng tĩnh `share.html?c=...`. Dạng này dài hơn nhưng hoạt động không cần máy chủ Python.

## GitHub Pages

1. Cài Git hoặc dùng nút **Add file → Upload files** trên GitHub.
2. Tải các tệp giao diện lên repository: `index.html`, `share.html`, `script.js`, `site.css`, `favicon.svg`.
3. Vào **Settings → Pages**, chọn branch `main` và thư mục `/root`.
4. Mở URL GitHub Pages được cấp, ví dụ `https://ten-ban.github.io/ten-repo/`.

GitHub Pages không chạy được `server.py`, không lưu được `uploads/` và không có link ngắn SQLite. Video, ảnh nền và ảnh con trỏ cần là URL công khai hoặc được lưu ở dịch vụ lưu trữ riêng.

## Triển khai

`server.py` lưu tệp vào thư mục `uploads/` và không đặt giới hạn dung lượng trong ứng dụng; dung lượng thực tế vẫn bị giới hạn bởi ổ đĩa và dịch vụ hosting. GitHub Pages và các host tĩnh không hỗ trợ endpoint upload này. Để chia sẻ qua Internet, triển khai server cùng thư mục `uploads/` lên máy chủ có dung lượng phù hợp và bảo vệ endpoint upload trước khi mở công khai.

## Mở thử nhanh

Nếu máy bạn có Python 3, chạy:

```bash
cd C:/Users/phamk/halloween-site
python server.py
```

Nếu lệnh `python` chưa trỏ tới Python 3.12, gọi trực tiếp file thực thi đã cài. Rồi mở:
```text
http://localhost:8000
```
