# Kiểm tra hiểu cấu trúc — Haravan Admin clone

> **Dùng cho:** AI agent trước khi clone/sửa bất kỳ trang nào trong `haravan_dashboard_html/`.
> **Mục đích:** chứng minh đã hiểu **cấu trúc phân tầng** trước khi tạo file — sai tầng ở bước này sẽ sinh ra file sai tên, sai mapping URL, và không thể sửa bằng "vá link" về sau.
> **Không thay thế** `.github/copilot-instructions.md` (quy tắc an toàn: chỉ GET, không đụng production). File này chỉ nói về **cấu trúc**.
> **Nguồn:** <https://chat.deepseek.com/share/8kbdmog7eaiv3s4ym2> — đã lọc bỏ toàn bộ nội dung không liên quan (CLI, backend, port, proxy, audit) và thay bằng dữ liệu thật của repo.
> **Danh mục trang:** xem `docs/sidebar-pages.md` (9 module + 31 sub-trang, kèm file tương ứng).

---

## 1. Định nghĩa 4 tầng

| Tầng | Định nghĩa | Dấu hiệu nhận biết | Đổi URL? |
|---|---|---|---|
| **0** | Root | `/admin/` | — |
| **1** | Trang chính — một mục trong sidebar trái | 1 mục sidebar = 1 module | có |
| **2** | Sub-trang / tab của module | expand mục tầng 1 ra thấy danh sách con | có |
| **3** | Trang chi tiết một bản ghi | URL có **ID** (`/admin/orders/1860611073`) | có |
| **4** | Modal / drawer / popup | mở ra từ trang hiện tại, **thanh địa chỉ không đổi** | **không** |

**Quy tắc phân biệt duy nhất cần nhớ:** *có đổi URL hay không*.
Không đổi URL ⇒ **tầng 4**. Có đổi và có ID ⇒ **tầng 3**. Có đổi, không có ID ⇒ **tầng 2** (hoặc tầng 1 nếu chính là mục sidebar).

---

## 2. Quy ước đặt tên file của repo

Quy tắc chung: bỏ tiền tố `/admin/`, thay `/` bằng `_`, thêm `.html`.

| Tầng | Pattern | Ví dụ thật |
|---|---|---|
| 0 / 1 | `<module>.html` | `products.html` (233 KB) · `orders.html` (132 KB) · `index.html` |
| 2 | `<module>_<sub>.html` | `products_collections.html` · `orders_checkouts.html` · `orders_mass_fulfill.html` · `draft_orders.html` |
| 3 | `<module>_<id>.html` | `orders_1860611073.html` · `customers_1047951949.html` · `discounts_1087069191.html` |
| 3 (biến thể) | `<module>_<id>_<sub>_<subid>.html` | `products_1031474001_variants_1068961180.html` |
| 3 (sub-tab của chi tiết) | `<tiền tố tầng 3>_<tab>.html` | `products_1031474001_variants_1068961180_transactions.html` |
| 4 | `<module>_<id>_<feature>.modal.html` *(đề xuất — chưa có file nào)* | — |

**Đường dẫn tài nguyên:** mọi tham chiếu phải **tương đối** (`assets/…`, `orders.html`). Không để `/admin/…`, `https://noritake.myharavan.com/…`, `//cdn.hstatic.net/…`.

**Sidebar:** nằm **inline trong từng file** (không có `_shared/`); click được nhờ `assets/clone-nav.js`.

---

## 3. Cây thật của 2 module mẫu

```
haravan_dashboard_html/
├── orders.html                          # T1  Đơn hàng = "Tất cả đơn hàng"
├── orders_checkouts.html                # T2  Chưa hoàn tất
├── orders_mass_fulfill.html             # T2  Giao hàng hàng loạt
├── orders_new.html                      # T2/T3 phụ (❓ xem §6)
├── orders_<id>.html                     × 43   # T3 chi tiết đơn
├── draft_orders.html                    # T2  Đơn hàng nháp
├── draft_orders_<hash>.html             × 50   # T3 chi tiết đơn nháp
│
├── products.html                        # T1  Sản phẩm
├── products_collections.html            # T2  Danh sách nhóm sản phẩm
├── products_collections_<id>.html       × 66   # T3 chi tiết nhóm
├── products_pricing_list.html           # T2  Danh sách bảng giá
├── products_<id>.html                   × 90   # T3 chi tiết sản phẩm
├── products_<id>_variants_<vid>.html    × 78   # T3 chi tiết biến thể
├── products_<id>_variants_new.html      × 23   # T3 tạo biến thể
└── products_<id>_variants_<vid>_transactions.html × 23   # T3 tab lịch sử kho
```

---

## 4. Bài kiểm tra bắt buộc (dán vào agent)

```markdown
# KIỂM TRA HIỂU CẤU TRÚC

Trước khi clone/sửa, trả lời 5 câu. Sai câu nào → DỪNG, hỏi lại, không đoán.

1. Với module "Đơn hàng", liệt kê đầy đủ tầng 1, các tầng 2, tầng 3, tầng 4
   và tên file tương ứng theo quy ước của repo.
2. "Modal thêm nhanh sản phẩm" thuộc tầng mấy? Vì sao không phải tầng 3?
3. Nếu tôi yêu cầu "clone trang bộ sưu tập", bạn tạo file gì, ở đâu,
   và tái sử dụng sidebar/điều hướng bằng cách nào?
4. Điều gì phân biệt "trang chi tiết sản phẩm" và "modal sửa sản phẩm"?
   Nếu nhầm 2 cái này, hậu quả cụ thể là gì?
5. Vẽ lại cây file hoàn chỉnh cho 2 module: Đơn hàng và Sản phẩm.
```

---

## 5. Đáp án chuẩn (dùng để tự chấm)

**Câu 1 — Đơn hàng**

| Tầng | File |
|---|---|
| 1 | `orders.html` |
| 2 | `orders.html` (Tất cả) · `draft_orders.html` · `orders_checkouts.html` · `orders_mass_fulfill.html` |
| 3 | `orders_<id>.html` ×43 · `draft_orders_<hash>.html` ×50 |
| 4 | **0 file** — chưa clone modal nào |

**Câu 2** — Tầng **4**. Modal không đổi URL nên **không sinh entry trong mapping URL→file**; tầng 3 thì luôn có URL riêng (43 file `orders_<id>.html` = 43 URL chi tiết).

**Câu 3** — `products_collections.html` (danh sách) + `products_collections_<id>.html` (chi tiết, hiện 66 file). Không tạo thư mục `_shared/`; sidebar đã inline trong trang, điều hướng do `assets/clone-nav.js` lo (đang gắn ở 587/761 trang).

**Câu 4**

| | Trang chi tiết | Modal sửa |
|---|---|---|
| URL | đổi (`/admin/products/123`) | không đổi |
| File | 1 file riêng | không có file |
| Hậu quả nếu nhầm | hàm `fileFor()` sinh 2 tên cho cùng URL ⇒ ghi đè file / mất trang; audit link đếm sai; mất trạng thái "quay lại danh sách" | |

**Câu 5** — xem cây ở §3.

---

## 6. Điều cấm

1. **Không gộp nhiều tầng vào 1 file.** Mỗi URL = 1 file `.html`.
2. **Không đoán URL.** Không chắc trang thuộc tầng nào → hỏi, hoặc dùng đúng quy tắc *"có đổi URL không?"*.
3. **Không tự thêm trang không có trong hệ thống thật.**
4. **Không nhầm modal (tầng 4) với trang chi tiết (tầng 3).**
5. **Không đổi tên file đã có** — `clone-nav.js`, `audit-nav.js`, `audit-rowlinks.js` đều dựa vào quy ước tên.

---

## 7. Bảng tra: sai tầng → hậu quả → cách phát hiện

| Sai | Hậu quả | Cách phát hiện |
|---|---|---|
| Modal bị lưu thành file tầng 3 | Sinh file không có URL thật ⇒ link chết, mapping sai | `audit-nav.js` báo đích thiếu |
| 2 URL khác nhau ghi vào 1 file | Trang này đè trang kia, mất nội dung | so số file với số URL đã biết (`crawl-report.json`) |
| Trang chi tiết đặt tên không theo `<module>_<id>` | `clone-nav.js` / `audit-rowlinks.js` không map được | dòng trong bảng bấm ra trang khác |
| Tầng 2 bị coi là tầng 1 | Sidebar trỏ sai mục, active state sai | `check-nav.js` báo "RA NGOÀI"/không OK |

---

## 8. Điểm chưa xác minh (phải hỏi trước khi dùng)

- ❓ **`orders_new.html`** (65 KB) có `<title>` là *"Đơn chưa hoàn tất"* — trùng với `orders_checkouts.html` ⇒ nghi là redirect của `/admin/orders/new`, hoặc lỗi capture. Chưa kết luận.
- ❓ **Hành vi expand sidebar** ("chỉ 1 module mở tại 1 thời điểm") **không chứng minh được** trên bản clone vì JS của site đã bị bỏ; chỉ đúng nếu viết shim.
- ❓ **Tầng 4 chưa có mẫu nào** để đối chiếu ⇒ pattern `.modal.html` mới là đề xuất, chưa được kiểm chứng.
