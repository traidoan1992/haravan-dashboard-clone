# Sidebar Haravan Admin — danh mục toàn bộ trang

> **Mục đích:** danh mục **đầy đủ** các trang trên sidebar `noritake.myharavan.com/admin` để agent tra cứu khi clone/audit.
> **Trạng thái:** 9/9 module + **31 sub-trang** — đã xác nhận bằng HTML sidebar thật, và **đã đối chiếu 1-1 với file tồn tại trong `haravan_dashboard_html/`** (33/33 file có mặt).
> **Nguồn:** hội thoại <https://chat.deepseek.com/share/8kbdmog7eaiv3s4ym2> (message cuối = `SIDEBAR_SPEC.md`), đã lọc bỏ phần không liên quan (backend local, `_shared/`, port 8080, hướng dẫn DevTools) và thay bằng đường dẫn file thật của repo.
> **Quy tắc an toàn** (chỉ GET, không bấm nút ghi): xem `.github/copilot-instructions.md`.
> **Tầng & quy ước tên file:** xem `docs/haravan-structure-check.md`.

---

## 1. Tổng quan 9 module

| # | Module (Tầng 1) | URL gốc | Sub | File trong repo | Đặc điểm |
|---|---|---|---|---|---|
| 1 | Tổng quan | `/admin/dashboard/generals` | 0 | `index.html` | active mặc định |
| 2 | Đơn hàng | `/admin/orders` | 4 | `orders.html` | badge động + 2 nút sparkle |
| 3 | Vận chuyển | `/admin/shipments/dashboard` | 6 | `shipments_dashboard.html` | có bug active ở sub #2 |
| 4 | Sản phẩm | `/admin/products` | 3 | `products.html` | module lớn nhất (293 file) |
| 5 | Khách hàng | `/admin/customers` | 6 | `customers.html` | app nhúng iframe |
| 6 | Quản lý tồn kho | `/admin/inventory/transactions` | 8 | `inventory_transactions.html` | nhiều sub nhất |
| 7 | Sổ quỹ | `/admin/accounting/transactions` | 2 | `accounting_transactions.html` | |
| 8 | Khuyến mãi | `/admin/discounts` | 0 | `discounts.html` | không expand |
| 9 | Báo cáo | `/admin/reports/dashboard` | 2 | `reports_dashboard.html` | app nhúng iframe |

**Tổng: 9 module · 31 sub-trang · 33 file** (sub #1 của mỗi module trùng URL module).

---

## 2. Chi tiết từng module

### 2.1 Tổng quan — 0 sub
| Nhãn | URL | File |
|---|---|---|
| Tổng quan | `/admin/dashboard/generals` | `index.html` |

### 2.2 Đơn hàng — 4 sub
| # | Nhãn | URL | File | Ghi chú |
|---|---|---|---|---|
| 1 | Tất cả đơn hàng | `/admin/orders` | `orders.html` | active mặc định · ✨ sparkle |
| 2 | Đơn hàng nháp | `/admin/draft_orders` | `draft_orders.html` | + 50 file `draft_orders_<hash>.html` |
| 3 | Chưa hoàn tất | `/admin/orders/checkouts` | `orders_checkouts.html` | |
| 4 | Giao hàng hàng loạt | `/admin/orders/mass_fulfill` | `orders_mass_fulfill.html` | ✨ sparkle |

> Chi tiết đơn: `orders_<id>.html` × 43.
> Ngoài spec: `orders_new.html` (title *"Đơn chưa hoàn tất"* — ❓ nghi trùng checkouts).

### 2.3 Vận chuyển — 6 sub
| # | Nhãn | URL | File | Ghi chú |
|---|---|---|---|---|
| 1 | Tổng quan | `/admin/shipments/dashboard` | `shipments_dashboard.html` | active mặc định |
| 2 | Vận chuyển | `/admin/shipments` | `shipments.html` | ⚠️ có `aria-current` nhưng **thiếu class active** |
| 3 | Quản lý thu hộ | `/admin/shipments/managecod` | `shipments_managecod.html` | |
| 4 | Đóng gói | `/admin/shipments/packed` | `shipments_packed.html` | |
| 5 | Biên bản bàn giao | `/admin/shipments/shipment_handovers` | `shipments_shipment_handovers.html` | |
| 6 | Biên bản hoàn hàng | `/admin/shipments/shipment_returns` | `shipments_shipment_returns.html` | |

### 2.4 Sản phẩm — 3 sub
| # | Nhãn | URL | File | Ghi chú |
|---|---|---|---|---|
| 1 | Tất cả sản phẩm | `/admin/products` | `products.html` | 233 KB, active mặc định |
| 2 | Nhóm sản phẩm | `/admin/products/collections` | `products_collections.html` | + 66 file `products_collections_<id>.html` |
| 3 | Bảng giá | `/admin/products/pricing_list` | `products_pricing_list.html` | |

> Chi tiết: `products_<id>.html` × 90 · `products_<id>_variants_<vid>.html` × 78 · `products_<id>_variants_new.html` × 23 · `products_<id>_variants_<vid>_transactions.html` × 23.

### 2.5 Khách hàng — 6 sub
| # | Nhãn | URL | File | Nhóm nghiệp vụ |
|---|---|---|---|---|
| 1 | Tất cả khách hàng | `/admin/customers` | `customers.html` | Quản lý khách |
| 2 | Nhóm khách hàng | `/admin/customers/segments` | `customers_segments.html` | Quản lý khách |
| 3 | Chiến dịch Broadcast | `/admin/customers/broadcast_campaigns` | `customers_broadcast_campaigns.html` | Marketing |
| 4 | Kịch bản tự động | `/admin/customers/flows` | `customers_flows.html` | Marketing |
| 5 | Quản lý đánh giá | `/admin/customers/rating` | `customers_rating.html` | Vận hành |
| 6 | Cấu hình thành viên | `/admin/customers/settings` | `customers_settings.html` | Vận hành |

> ⚠️ Toàn bộ module này render bằng **iframe `customers.haravan.app`** ⇒ không clone được nội dung; bản clone chỉ giữ khung + ghi chú.

### 2.6 Quản lý tồn kho — 8 sub
| # | Nhãn | URL | File | Loại |
|---|---|---|---|---|
| 1 | Chi tiết tồn kho | `/admin/inventory/transactions` | `inventory_transactions.html` | Bảng tồn |
| 2 | Đặt hàng | `/admin/inventory/purchasing_orders` | `inventory_purchasing_orders.html` | PO |
| 3 | Nhập hàng | `/admin/inventory/inventory_receives` | `inventory_inventory_receives.html` | Goods Receipt |
| 4 | Trả hàng nhập | `/admin/inventory/purchase_returns` | `inventory_purchase_returns.html` | Purchase Return |
| 5 | Nhà cung cấp | `/admin/inventory/suppliers` | `inventory_suppliers.html` | Master data |
| 6 | Kiểm kho | `/admin/inventory/stock_takes` | `inventory_stock_takes.html` | Stock Take |
| 7 | Điều chuyển | `/admin/inventory/transfers` | `inventory_transfers.html` | Stock Transfer |
| 8 | Lịch sử | `/admin/inventory/activities` | `inventory_activities.html` | Audit log |

### 2.7 Sổ quỹ — 2 sub
| # | Nhãn | URL | File |
|---|---|---|---|
| 1 | Sổ quỹ | `/admin/accounting/transactions` | `accounting_transactions.html` |
| 2 | Công nợ | `/admin/accounting/debts` | `accounting_debts.html` |

> Chi tiết giao dịch: `accounting_transactions_<id>.html` × 32.

### 2.8 Khuyến mãi — 0 sub
| Nhãn | URL | File |
|---|---|---|
| Khuyến mãi | `/admin/discounts` | `discounts.html` |

> Chi tiết: `discounts_<id>.html` (3 file).

### 2.9 Báo cáo — 2 sub
| # | Nhãn | URL | File | Loại |
|---|---|---|---|---|
| 1 | Bảng phân tích | `/admin/reports/dashboard` | `reports_dashboard.html` | Chart/BI |
| 2 | Danh sách báo cáo | `/admin/reports/listing` | `reports_listing.html` | DataTable |

> ⚠️ Render bằng iframe `reports.haravan.app` ⇒ không clone được nội dung.
> Đặc biệt: sub #1 **không trùng tên module** (khác 8 module còn lại).

---

## 3. Trang có trong repo nhưng **KHÔNG** nằm trên sidebar

Các mục này nằm ở menu tài khoản/góc trên-phải ⇒ **không tính** vào 9 module, nhưng vẫn đã clone:

| Nhóm | File | Số lượng |
|---|---|---|
| Kênh bán hàng | `sale_channels_*.html` | 14 |
| Ứng dụng | `apps.html` | 1 |
| Cấu hình | `settings_*.html` | 32 |
| Marketing | `marketings_tiktok_ads_*.html` | 2 |
| Google Shop | `googleshop_*.html` | 4 |

---

## 4. Quy tắc trạng thái active (dùng khi clone/sửa sidebar)

| Cấp | Trạng thái | Class | Icon |
|---|---|---|---|
| Tầng 1 | không active | `_menu_item_wrapper_{hash}` | `fill="#4B5563"` (xám) |
| Tầng 1 | active, **không** expand | `_menu_item_wrapper_active_{hash}` | `fill="#2463EB"` (xanh) |
| Tầng 1 | active, **đang** expand | `_menu_item_wrapper_active_transparent_{hash}` | `fill="#2463EB"` |
| Tầng 2 | không active | `_menu_item_child_item_{hash}` | — |
| Tầng 2 | active | `_menu_item_child_item_active_{hash} active` + `aria-current="page"` | — |

- **Quy tắc vàng:** chỉ dựa vào **class** để xác định active; bỏ qua `aria-current` mồ côi (bug ở sub "Vận chuyển").
- Module **không có sub** (Tổng quan, Khuyến mãi) → không có `_menu_item_childs_`.
- **Badge**: chỉ "Đơn hàng" có, là bộ đếm **toàn cục**, giá trị động ⇒ trong bản clone phải là placeholder (`data-badge="orders-count"`), không hardcode.
- **Sparkle ✨**: chỉ ở "Tất cả đơn hàng" và "Giao hàng hàng loạt"; `<button class="haravan-btn haravan-btn-size-S btn-mono--tertiary">`, SVG data-URI `#9CA3B0`; click **không được** gọi API.

---

## 5. Điều cấm khi dùng danh mục này

1. **Không tự thêm module/sub-trang ngoài danh mục** — mọi trang mới phải xuất phát từ HTML thật.
2. **Không đoán sub-trang** của module chưa có dữ liệu.
3. **Không hardcode** số badge (290/291…).
4. **Không đổi hash class** (`_xqvgu_205`, `_1la9f_1`…) — CSS-module phụ thuộc vào chúng.
5. **Không render `aria-current` mồ côi** (bug "Vận chuyển").

---

## 6. Checklist kiểm chứng (sau khi sửa sidebar/nav)

- [ ] Đủ 9 module tầng 1, đúng thứ tự 1→9.
- [ ] Module có sub → expand đúng số: 4 / 6 / 3 / 6 / 8 / 2 / 2.
- [ ] Module không sub (Tổng quan, Khuyến mãi) → không expand.
- [ ] Mỗi sub-trang trong §2 mở ra **đúng file** tương ứng (31 mục).
- [ ] Badge "Đơn hàng" là placeholder, không phải số cứng.
- [ ] Icon active `#2463EB`, không active `#4B5563`.
- [ ] Không có request nào tới `noritake.myharavan.com` (log `[BLOCKED]` = 0 với GET-only).
