# Quy tắc dự án — Noritake Admin Clone (chỉ đọc HTML/CSS)

## 🎯 Mục tiêu duy nhất

Sao chép **giao diện** (HTML + CSS + asset tĩnh) của `https://noritake.myharavan.com/admin/` về repo này để dựng một bản clone chạy hoàn toàn offline ở `haravan_dashboard_html/` + `node server/server.js`.

- **Chỉ lấy HTML/CSS/JS tĩnh phục vụ hiển thị.** Không quan tâm dữ liệu sống, không quan tâm API, không quan tâm database.
- **Không có backend.** Không dựng Express, không Mongo, không seed, không endpoint. Nếu cần dữ liệu để hiển thị thì nhúng tĩnh vào HTML.

---

## ⛔ BẤT BIẾN #1 — Hệ thống thật CHỈ ĐƯỢC ĐỌC BẰNG `GET`

- Nguồn: `https://noritake.myharavan.com/admin/` — **PRODUCTION đang chạy thật**.
- **Chỉ được phép `GET`** (tải HTML, tải CSS/JS/font/ảnh, xem DOM, chụp màn hình).
- **NGHIÊM CẤM TUYỆT ĐỐI** mọi method khác `GET`/`HEAD`/`OPTIONS` tới `noritake.myharavan.com`, `*.haravan.com`, `*.haravan.app` hoặc API của nó:
  - `POST` · `PUT` · `PATCH` · `DELETE`
  - `fetch()` / `XMLHttpRequest` / `$.ajax` / `sendBeacon` tới domain thật — **kể cả khi chỉ để “đọc”**.
  - Submit form, bấm Lưu / Tạo / Cập nhật / Xoá / Xác nhận / chuyển trạng thái / kéo-thả / bật-tắt switch.
  - “Bấm thử cho biết”, “chỉ thử một lần”, “thử trên dữ liệu test” — **tất cả đều bị cấm**.

### ⛔ BẤT BIẾN #2 — Không đụng database, không đụng method

- **Không kết nối, không đọc, không ghi, không đoán** database của hệ thống thật (MySQL/Mongo/Redis của Haravan). Không có quyền và không được thử.
- **Không gọi bất kỳ API nào** của hệ thống thật, kể cả API “chỉ đọc” (`/admin/call/com_api/...`, `/admin/api/...`, `/webhook/...`).
- Không có “mirror ghi”, không có “proxy 2 chiều”, không có whitelist method.

### ⛔ BẤT BIẾN #3 — Cookie/session là của người dùng

- Cookie phiên đăng nhập nằm ở `_mirror/cookie.txt` (file này **không commit, không chia sẻ, không copy ra ngoài máy**).
- Cookie hết hạn → **dừng lại, yêu cầu người dùng tự đăng nhập lại và cập nhật file**. Không tự động đăng nhập, không lưu mật khẩu.

### ⛔ BẤT BIẾN #4 — Nếu phải vượt ranh giới thì DỪNG

Bất kỳ tác vụ nào **có khả năng** tạo ra request không phải `GET` lên hệ thống thật → **dừng lại và hỏi người dùng** trước khi làm. Không tự quyết.

---

## 🛡️ Cơ chế enforcement (bắt buộc nằm trong CODE, không chỉ trong lời)

Quy tắc chỉ có giá trị khi được **chặn ở tầng network**. Mọi script điều khiển trình duyệt phải làm 3 việc:

1. **Allowlist method, chặn mọi thứ khác** — kể cả request do chính JS của trang Haravan tự phát ra:
   - CDP: `Fetch.enable({ patterns: [...] })` → `Fetch.requestPaused` → nếu `method ∉ {GET, HEAD, OPTIONS}` thì `Fetch.failRequest({ errorReason: 'Aborted' })` + ghi log `[BLOCKED] <method> <url>`; ngược lại `Fetch.continueRequest`.
     - Chỉ cần intercept các `resourceType` có thể mang thao tác ghi: `Document`, `XHR`, `Fetch`, `Ping`, `Other` (sendBeacon báo là `Ping`; **`Beacon` KHÔNG phải resourceType hợp lệ** — sai sẽ báo `Unknown resource type in fetch filter`). Ảnh/CSS/JS/font cho đi thẳng để crawl không chậm.
   - Playwright: `page.route('**', r => r.request().method() === 'GET' ? r.continue() : r.abort())`.
   - Puppeteer: `page.setRequestInterception(true)` + `abort()` cho non-GET.
   - Đã cài trong: `_tools/crawl.js`, `_tools/capture-browser.js` (`cdp.onEvent` + `Fetch.enable`).
2. **Log mọi request** ra `_tools/logs/net-YYYYMMDD.log` theo dạng `[GET] <url>` / `[BLOCKED] <method> <url>` (không log cookie/header nhạy cảm). Proxy `_mirror/proxy.js` ghi `_mirror/net-YYYYMMDD.log`.
3. **Tổng kết cuối mỗi lần crawl**: in ra số request theo method. Số `BLOCKED` phải được nêu rõ trong báo cáo — đó là bằng chứng quy tắc được thi hành.

Riêng `_mirror/proxy.js` (nếu còn dùng): `READ_ONLY = true` **VÀ** `ALLOW_POST_PREFIXES = []` (rỗng). Không được bật `READ_ONLY = false`, không được thêm prefix vào whitelist.

---

## 📦 Phạm vi clone

### Phải clone

Toàn bộ 8 module và **mọi trang con / trang nằm trong trang**:

| Module | Đường dẫn | Gồm |
|---|---|---|
| Dashboard | `/admin/dashboard/generals` | trang tổng quan |
| Đơn hàng | `/admin/orders` | danh sách + **mọi trang chi tiết** `/admin/orders/<id>`, đơn nháp `/admin/draft_orders/<id>` |
| Sản phẩm | `/admin/products` | danh sách + **mọi trang chi tiết** `/admin/products/<id>`, biến thể, bộ sưu tập |
| Khách hàng | `/admin/customers` | danh sách + **mọi trang chi tiết** `/admin/customers/<id>`, phân nhóm, luồng, đánh giá, cài đặt |
| Kho | `/admin/inventory/transactions` | giao dịch, phiếu nhập, chuyển kho, kiểm kê, nhà cung cấp, trả hàng |
| Kế toán | `/admin/accounting/transactions` | danh sách + **mọi trang chi tiết giao dịch**, công nợ |
| Khuyến mãi | `/admin/discounts` | danh sách + **mọi trang chi tiết** `/admin/discounts/<id>` |
| Báo cáo | `/admin/reports/dashboard` | các trang báo cáo con |

Nguyên tắc: **đi hết cây** — từ trang danh sách mở từng dòng/chi tiết, từ trang chi tiết mở tiếp tab/route con, cho tới khi không còn URL nội bộ mới.

### Không clone

- **Pagination**: chỉ trang **1** của mỗi danh sách. Không crawl trang 2, 3, 4… (mục đích là demo giao diện, không cần toàn bộ dữ liệu).
- **Ứng dụng iframe khác origin** (`customers.haravan.app`, `reports.haravan.app`, …): không thể clone nội dung. Giữ iframe + chèn ghi chú “trang nhúng, chưa clone” kèm link tới trang thật để **người dùng tự xem**.
- Trang login/logout/thanh toán thật, màn hình xác nhận hành động.

---

## 📁 Quy ước file & asset

> Trước khi tạo/sửa trang: đọc `docs/haravan-structure-check.md` (định nghĩa 4 tầng, quy ước tên file, 5 câu tự kiểm tra hiểu cấu trúc) và `docs/sidebar-pages.md` (danh mục 9 module + 31 sub-trang trên sidebar, kèm file tương ứng).

- URL thật → file: bỏ tiền tố `/admin/`, thay `/` bằng `_`, thêm `.html`.
  - `/admin/orders/1860611073` → `orders_1860611073.html`
  - `/admin` và `/admin/dashboard/generals` → `index.html`
- Mọi tham chiếu trong HTML phải là **đường dẫn tương đối** (`assets/...`, `orders.html`). **Cấm** để lại:
  - `https://noritake.myharavan.com/...` (link tuyệt đối tới admin thật)
  - `/admin/assets/...` (root-relative)
  - `//cdn.hstatic.net/...`, `//product.hstatic.net/...` (protocol-relative) — phải tải về `assets/` hoặc ghi rõ trong báo cáo là ngoại lệ chưa offline.
- Không để `<form action="https://noritake...">`. Form trong bản clone phải `action="#"` + `onsubmit="return false"`.
- Sidebar phải điều hướng được qua `assets/clone-nav.js` (map nhãn → file local).

---

## ✅ Được phép sửa

- `haravan_dashboard_html/**` — toàn bộ giao diện clone.
- `server/server.js` — static server (port **3100**), chỉ phục vụ file, **không** thêm route ghi dữ liệu mới.
- `_tools/**` — công cụ crawl/kiểm tra (phải tuân enforcement ở trên).
- `.github/**`, tài liệu.

## ⛔ Cấm sửa

- Bất kỳ thứ gì trên `noritake.myharavan.com` (kể cả qua proxy, extension, DevTools protocol).
- `.env`, credential, cookie của hệ thống thật.

---

## 🔍 Kiểm chứng bắt buộc (read-only, không cần backend)

Chạy trước khi báo “xong”, và nêu số liệu thật:

| Kiểm tra | Công cụ | Ngưỡng đạt |
|---|---|---|
| Link nội bộ hỏng | `_tools/audit-nav.js` | 0 |
| CSS/JS/font 404 | `_tools/assets-report.js` | 0 |
| Còn URL tuyệt đối tới domain thật | `_tools/audit-static.js` | 0 |
| Còn URL protocol-relative | `_tools/audit-proto.js` | 0 (hoặc có ngoại lệ được ghi rõ) |
| Sidebar điều hướng được | `_tools/check-nav.js` | 18/18 mục |
| Dòng trong bảng mở đúng chi tiết | `_tools/audit-rowlinks.js` | 0 sai |
| Số request non-GET đã chặn | log của crawler | in ra số `BLOCKED` |

---

## 🗺️ Pipeline THỰC TẾ (đúng như code hiện có)

Khi người dùng báo lỗi, Copilot **không sửa code ngay** — xác định lỗi thuộc bước nào:

### Bước 1 — Harvest HTML/CSS (chỉ GET)
- Công cụ: `_tools/capture-browser.js` hoặc `_tools/crawl.js` (Edge + CDP + cookie), **có chặn non-GET**.
- Vì admin là SPA (React) render phía client: `GET` thường chỉ trả shell ~14 KB → **bắt buộc render bằng trình duyệt thật** rồi mới lấy `outerHTML`.
- Output: `.html` + `haravan_dashboard_html/assets/`.
- Lỗi thường gặp: thiếu cookie (bị đá về login), chờ chưa đủ lâu (lưu trang thiếu), URL ngoài phạm vi.

### Bước 2 — Localize (vá đường dẫn)
- `_tools/relink.js` + `_tools/localize-new.js` + `_tools/fix-scheme.js`: tuyệt đối/root-relative/protocol-relative → tương đối; tải asset còn thiếu.
- Lỗi thường gặp: CSS 404 vì `/admin/assets/x.css`, hoặc URL không scheme thành `noritake.myharavan.com/admin/...`.

### Bước 3 — Serve static
- `node server/server.js` → `http://127.0.0.1:3100` (`PORT` env để đổi).
- Không cần backend, không cần Mongo.
- Lỗi thường gặp: port bị chiếm, mở sai file (phải mở qua HTTP, không mở `file://`).

### Bước 4 — Điều hướng & tương tác trong bản clone
- Sidebar, dòng trong bảng, tab, dropdown, popup **chỉ là mô phỏng UI** — không gọi API nào.
- Kiểm tra bằng browser thật: bấm sidebar 18 mục, bấm 1 dòng mỗi danh sách, mở 1 popup.

> ⚠️ **Không tồn tại** trong repo này: Express backend, MongoDB `noritake_admin`, `server/seed.js`, `GET /api/health`, port 3000, `server/db.js`. Nếu tài liệu/agent nào nhắc tới các thứ đó → **bỏ qua**, chúng là tàn dư của kế hoạch cũ.

---

## 🧭 Quy tắc debug

- Mỗi lần chỉ debug **MỘT** bước. Không sửa nhiều bước cùng lúc.
- Trước khi sửa, nói rõ: *“Lỗi này thuộc bước X vì …”*.
- Không chắc lỗi ở đâu → yêu cầu người dùng dán output terminal / Network tab / ảnh chụp.
- **Không bao giờ** “sửa” một lỗi bằng cách gọi lên hệ thống thật để so sánh dữ liệu động.

---

## 📋 Checklist trước khi báo “xong”

- [ ] Không có request non-GET nào tới domain thật (đã in log `BLOCKED`).
- [ ] Mọi trang trong phạm vi đều có file `.html` (kèm số lượng).
- [ ] 0 link nội bộ hỏng · 0 asset 404 · 0 URL tuyệt đối tới admin thật.
- [ ] Sidebar 18/18 điều hướng được; dòng trong bảng mở đúng chi tiết.
- [ ] Không có `seed.js` / Mongo / port 3000 trong bất kỳ thay đổi nào.


