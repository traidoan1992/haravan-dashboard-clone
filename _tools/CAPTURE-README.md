# Chụp lại các trang còn thiếu (chỉ GET)

## 1. Lấy cookie phiên admin
1. Mở Chrome/Edge, vào `https://noritake.myharavan.com/admin/` và đăng nhập.
2. DevTools (F12) → tab **Network** → F5 → chọn request `admin` (document) đầu tiên.
3. Ở **Request Headers**, copy toàn bộ giá trị của dòng `Cookie:` (một chuỗi dài, có các cặp `ten=gia_tri; ...`).
4. Dán vào file `_mirror/cookies.txt` (một dòng duy nhất, không thêm chữ gì khác).
   - File này chỉ dùng cho GET, không bao giờ gửi POST/PUT/DELETE.

> Không dán cookie vào chat. Chỉ lưu vào file.

## 2. Chạy thử (không ghi file)
```powershell
cd C:\Users\Administrator\Desktop\haravan_dashboard
node _tools/capture.js --probe
```
Kết quả mong đợi: 3 dòng `OK` với `title` đúng (vd. `… ~ Đơn hàng nháp ~ Haravan`).
- `title` có `Lỗi 404` → route đó thật sự không tồn tại với tài khoản này (báo lại để đổi đường dẫn).
- Có `trang đăng nhập (cookie hết hạn)` → lấy lại cookie.

## 3. Ghi file
```powershell
node _tools/capture.js --fetch
```

## 4. Gắn link lại (bắt buộc, vì HTML mới chứa URL tuyệt đối)
```powershell
node _tools/relink.js --apply
node _tools/fix-rows.js --apply
node _tools/check-links.js
node _tools/smoke-http.js
```

## Ghi chú
- Script chỉ gọi `GET`; không có nhánh nào gửi body → không thể ghi lên hệ thống thật.
- File cũ được sao lưu vào `_tools/_backup/<ten>.old` trước khi ghi đè.
- Danh sách trang cần chụp nằm trong `TARGETS` của `capture.js` (hiện: `draft_orders`, `inventory/inventory_receives`, `inventory/purchase_returns`).
