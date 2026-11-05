const express = require('express');
const { ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const { get } = require('../db');
const router = express.Router();

function col(n) { return get().collection(n); }
function toNum(v) { const n = Number(v); return isFinite(n) ? n : 0; }
function oid(id) { try { return new ObjectId(id); } catch (e) { return null; } }

// ---------- dashboard summary ----------
router.get('/stats/summary', async (req, res, next) => {
  try {
    const [ordersCount, revAgg, customersCount, productsCount, lowStock] = await Promise.all([
      col('orders').countDocuments(),
      col('orders').aggregate([{ $group: { _id: null, s: { $sum: '$total' } } }]).next(),
      col('customers').countDocuments(),
      col('products').countDocuments(),
      col('products').countDocuments({ stock: { $lte: 5 } })
    ]);
    res.json({
      revenue: revAgg ? revAgg.s : 0,
      ordersCount, customersCount, productsCount, lowStock
    });
  } catch (e) { next(e); }
});

// ---------- products ----------
router.get('/products', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(1, toNum(req.query.page) || 1);
    const limit = Math.min(200, toNum(req.query.limit) || 50);
    const filter = q ? { $or: [{ name: { $regex: q, $options: 'i' } }, { sku: { $regex: q, $options: 'i' } }, { brand: { $regex: q, $options: 'i' } }] } : {};
    if (req.query.legacy) filter.legacyId = toNum(req.query.legacy);
    const total = await col('products').countDocuments(filter);
    const items = await col('products').find(filter).sort({ _id: -1 }).skip((page - 1) * limit).limit(limit).toArray();
    res.json({ items, total, page, pages: Math.ceil(total / limit), limit });
  } catch (e) { next(e); }
});
router.get('/products/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const doc = await col('products').findOne({ _id });
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (e) { next(e); }
});
router.post('/products', async (req, res, next) => {
  try {
    const b = req.body || {};
    const doc = {
      name: String(b.name || 'Sản phẩm mới').trim(),
      sku: String(b.sku || ('SP' + Date.now())).trim(),
      brand: String(b.brand || '').trim(),
      type: String(b.type || 'Sản phẩm').trim(),
      price: toNum(b.price),
      cost: toNum(b.cost),
      stock: toNum(b.stock),
      available: toNum(b.available),
      onOrder: toNum(b.onOrder),
      incoming: toNum(b.incoming),
      image: b.image || null,
      images: Array.isArray(b.images) ? b.images.map(String) : (b.image ? [String(b.image)] : []),
      createdAt: new Date()
    };
    const r = await col('products').insertOne(doc);
    res.status(201).json(Object.assign({ _id: r.insertedId }, doc));
  } catch (e) { next(e); }
});
router.put('/products/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const b = req.body || {};
    const upd = {};
    for (const k of ['name', 'sku', 'brand', 'type', 'image']) if (b[k] !== undefined) upd[k] = String(b[k]);
    if (Array.isArray(b.images)) { upd.images = b.images.map(String); if (!b.image && upd.images.length) upd.image = upd.images[0]; }
    if (b.collectionId !== undefined) upd.collectionId = b.collectionId ? oid(b.collectionId) : null;
    for (const k of ['price', 'cost', 'stock', 'available', 'onOrder', 'incoming']) if (b[k] !== undefined) upd[k] = toNum(b[k]);
    const r = await col('products').findOneAndUpdate({ _id }, { $set: upd }, { returnDocument: 'after' });
    const doc = r && r.value !== undefined ? r.value : r;
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (e) { next(e); }
});
// thêm ảnh cho sản phẩm (ghi tệp vào assets/uploads rồi push vào images[])
router.post('/products/:id/images', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const b = req.body || {};
    const name = String(b.name || 'anh.png').replace(/[^\w.\-]+/g, '_');
    const m = String(b.data || '').match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: 'Dữ liệu ảnh không hợp lệ' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 15 * 1024 * 1024) return res.status(413).json({ error: 'Ảnh quá lớn (tối đa 15MB)' });
    const dir = path.join(__dirname, '..', '..', 'haravan_dashboard_html', 'assets', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const fileName = Date.now() + '_' + name;
    fs.writeFileSync(path.join(dir, fileName), buf);
    const rel = 'assets/uploads/' + fileName;
    const doc = await col('products').findOne({ _id });
    if (!doc) return res.status(404).json({ error: 'not found' });
    const upd = { $push: { images: rel } };
    if (!doc.image) upd.$set = { image: rel };
    await col('products').updateOne({ _id }, upd);
    await col('files').insertOne({ name: name, path: rel, type: (name.split('.').pop() || '').toUpperCase(), size: buf.length, createdAt: new Date() });
    const fresh = await col('products').findOne({ _id });
    res.status(201).json(fresh);
  } catch (e) { next(e); }
});

router.delete('/products/:id', async (req, res, next) => {  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const r = await col('products').deleteOne({ _id });
    res.json({ deleted: r.deletedCount });
  } catch (e) { next(e); }
});

// ---------- orders ----------
router.get('/orders', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(1, toNum(req.query.page) || 1);
    const limit = Math.min(200, toNum(req.query.limit) || 50);
    const filter = q ? { $or: [{ code: { $regex: q, $options: 'i' } }, { customerName: { $regex: q, $options: 'i' } }, { phone: { $regex: q, $options: 'i' } }] } : {};
    if (req.query.status) filter.fulfillmentStatus = String(req.query.status);
    if (req.query.legacy) filter.legacyId = toNum(req.query.legacy);
    if (req.query.archived !== '1') filter.archived = { $ne: true };
    const total = await col('orders').countDocuments(filter);
    const items = await col('orders').find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray();
    res.json({ items, total, page, pages: Math.ceil(total / limit), limit });
  } catch (e) { next(e); }
});
router.get('/orders/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const doc = await col('orders').findOne({ _id });
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (e) { next(e); }
});
router.post('/orders', async (req, res, next) => {
  try {
    const b = req.body || {};
    const doc = {
      code: String(b.code || ('DH' + Math.floor(100000 + Math.random() * 899999))),
      customerName: String(b.customerName || 'Khách lẻ'),
      email: String(b.email || ''),
      phone: String(b.phone || ''),
      shippingName: String(b.shippingName || ''),
      shippingPhone: String(b.shippingPhone || ''),
      shippingAddress: String(b.shippingAddress || ''),
      shippingCarrier: String(b.shippingCarrier || ''),
      trackingCode: String(b.trackingCode || ''),
      trackingNumber: String(b.trackingNumber || ''),
      paymentStatus: String(b.paymentStatus || 'Chưa thanh toán'),
      fulfillmentStatus: String(b.fulfillmentStatus || 'Chưa giao hàng'),
      cod: toNum(b.cod),
      itemsCount: toNum(b.itemsCount),
      subtotal: toNum(b.subtotal),
      discountAmount: toNum(b.discountAmount),
      shippingFee: toNum(b.shippingFee),
      total: toNum(b.total),
      paidAmount: toNum(b.paidAmount),
      refundedAmount: toNum(b.refundedAmount),
      note: String(b.note || ''),
      timeline: Array.isArray(b.timeline) ? b.timeline : [],
      channel: String(b.channel || 'Website'),
      packed: !!b.packed,
      archived: false,
      createdAt: new Date(),
      items: Array.isArray(b.items) ? b.items : []
    };
    const r = await col('orders').insertOne(doc);
    res.status(201).json(Object.assign({ _id: r.insertedId }, doc));
  } catch (e) { next(e); }
});
router.put('/orders/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const b = req.body || {};
    const upd = {};
    for (const k of ['customerName', 'email', 'phone', 'shippingName', 'shippingPhone', 'shippingAddress', 'shippingCarrier', 'trackingCode', 'trackingNumber', 'paymentStatus', 'fulfillmentStatus', 'channel']) if (b[k] !== undefined) upd[k] = String(b[k]);
    for (const k of ['cod', 'itemsCount', 'subtotal', 'discountAmount', 'shippingFee', 'total', 'paidAmount', 'refundedAmount']) if (b[k] !== undefined) upd[k] = toNum(b[k]);
    if (b.note !== undefined) upd.note = String(b.note);
    if (Array.isArray(b.timeline)) upd.timeline = b.timeline;
    if (b.packed !== undefined) upd.packed = !!b.packed;
    if (b.archived !== undefined) upd.archived = !!b.archived;
    const r = await col('orders').findOneAndUpdate({ _id }, { $set: upd }, { returnDocument: 'after' });
    const doc = r && r.value !== undefined ? r.value : r;
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (e) { next(e); }
});
router.delete('/orders/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const r = await col('orders').deleteOne({ _id });
    res.json({ deleted: r.deletedCount });
  } catch (e) { next(e); }
});

// ---------- customers ----------
router.get('/customers', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const seg = (req.query.segment || '').trim();
    const cond = [];
    if (q) cond.push({ $or: [{ name: { $regex: q, $options: 'i' } }, { phone: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }] });
    if (seg) cond.push({ segments: seg });
    if (req.query.legacy) cond.push({ legacyId: toNum(req.query.legacy) });
    const filter = cond.length ? (cond.length === 1 ? cond[0] : { $and: cond }) : {};
    const items = await col('customers').find(filter).sort({ totalSpent: -1 }).limit(200).toArray();
    res.json({ items, total: items.length });
  } catch (e) { next(e); }
});
router.post('/customers', async (req, res, next) => {
  try {
    const b = req.body || {};
    const doc = { name: String(b.name || 'Khách mới'), phone: String(b.phone || ''), email: String(b.email || ''), address: String(b.address || ''), note: String(b.note || ''), segments: Array.isArray(b.segments) ? b.segments.map(String) : [], ordersCount: toNum(b.ordersCount), totalSpent: toNum(b.totalSpent), createdAt: new Date() };
    const r = await col('customers').insertOne(doc);
    res.status(201).json(Object.assign({ _id: r.insertedId }, doc));
  } catch (e) { next(e); }
});
router.put('/customers/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const b = req.body || {};
    const upd = {};
    for (const k of ['name', 'phone', 'email', 'address', 'note']) if (b[k] !== undefined) upd[k] = String(b[k]);
    if (Array.isArray(b.segments)) upd.segments = b.segments.map(String);
    for (const k of ['ordersCount', 'totalSpent']) if (b[k] !== undefined) upd[k] = toNum(b[k]);
    const r = await col('customers').findOneAndUpdate({ _id }, { $set: upd }, { returnDocument: 'after' });
    const doc = r && r.value !== undefined ? r.value : r;
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (e) { next(e); }
});
router.delete('/customers/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const r = await col('customers').deleteOne({ _id });
    res.json({ deleted: r.deletedCount });
  } catch (e) { next(e); }
});
router.get('/customers/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const customer = await col('customers').findOne({ _id });
    if (!customer) return res.status(404).json({ error: 'not found' });
    const orders = await col('orders').find({ customerId: _id }).sort({ createdAt: -1 }).limit(100).toArray();
    res.json({ customer, orders });
  } catch (e) { next(e); }
});

// ---------- customer segments (nhóm khách hàng) ----------
router.get('/segments', async (req, res, next) => {
  try {
    const items = await col('segments').find({}).sort({ createdAt: 1 }).toArray();
    const counts = await col('customers').aggregate([
      { $unwind: '$segments' }, { $group: { _id: '$segments', n: { $sum: 1 } } }
    ]).toArray();
    const map = {};
    counts.forEach(c => { map[c._id] = c.n; });
    res.json({ items: items.map(s => Object.assign({}, s, { customerCount: map[s.name] || 0 })), total: items.length });
  } catch (e) { next(e); }
});
router.post('/segments', async (req, res, next) => {
  try {
    const b = req.body || {};
    const doc = { name: String(b.name || 'Nhóm mới').trim(), condition: String(b.condition || ''), description: String(b.description || ''), createdAt: new Date() };
    const r = await col('segments').insertOne(doc);
    res.status(201).json(Object.assign({ _id: r.insertedId, customerCount: 0 }, doc));
  } catch (e) { next(e); }
});
router.put('/segments/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const b = req.body || {};
    const upd = {};
    for (const k of ['name', 'condition', 'description']) if (b[k] !== undefined) upd[k] = String(b[k]);
    const r = await col('segments').findOneAndUpdate({ _id }, { $set: upd }, { returnDocument: 'after' });
    const doc = r && r.value !== undefined ? r.value : r;
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (e) { next(e); }
});
router.delete('/segments/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const doc = await col('segments').findOne({ _id });
    const r = await col('segments').deleteOne({ _id });
    if (doc) await col('customers').updateMany({ segments: doc.name }, { $pull: { segments: doc.name } });
    res.json({ deleted: r.deletedCount });
  } catch (e) { next(e); }
});

// ---------- channels (kênh bán hàng / marketing) ----------
router.get('/channels', async (req, res, next) => {
  try {
    const items = await col('channels').find({}).toArray();
    const agg = await col('orders').aggregate([
      { $group: { _id: '$channel', orders: { $sum: 1 }, revenue: { $sum: '$total' }, lastOrder: { $max: '$createdAt' } } }
    ]).toArray();
    const map = {};
    agg.forEach(a => { map[a._id] = a; });
    res.json({
      items: items.map(c => Object.assign({}, c, {
        orders: (map[c.channel] || {}).orders || 0,
        revenue: (map[c.channel] || {}).revenue || 0,
        lastOrder: (map[c.channel] || {}).lastOrder || null
      }))
    });
  } catch (e) { next(e); }
});
router.put('/channels/:key', async (req, res, next) => {
  try {
    const b = req.body || {};
    const upd = {};
    for (const k of ['title', 'shopId', 'note', 'channel']) if (b[k] !== undefined) upd[k] = String(b[k]);
    if (b.connected !== undefined) upd.connected = !!b.connected;
    if (b.sync) upd.syncedAt = new Date();
    const r = await col('channels').findOneAndUpdate({ key: String(req.params.key) }, { $set: upd }, { returnDocument: 'after' });
    const doc = r && r.value !== undefined ? r.value : r;
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (e) { next(e); }
});
router.get('/channels/:key/summary', async (req, res, next) => {
  try {
    const cfg = await col('channels').findOne({ key: String(req.params.key) });
    if (!cfg) return res.status(404).json({ error: 'not found' });
    const match = { channel: cfg.channel };
    const recentOrders = await col('orders').find(match).sort({ createdAt: -1 }).limit(8).toArray();
    const agg = await col('orders').aggregate([
      { $match: match },
      { $facet: {
        kpi: [{ $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$total' }, items: { $sum: '$itemsCount' } } }],
        byStatus: [{ $group: { _id: '$fulfillmentStatus', n: { $sum: 1 } } }],
        topProducts: [
          { $unwind: '$items' },
          { $group: { _id: '$items.name', qty: { $sum: '$items.qty' }, revenue: { $sum: '$items.subtotal' } } },
          { $sort: { qty: -1 } }, { $limit: 10 }
        ]
      } }
    ]).toArray();
    const f = agg[0] || {};
    const kpi = (f.kpi && f.kpi[0]) || { orders: 0, revenue: 0, items: 0 };
    res.json({
      channel: cfg,
      kpi: { orders: kpi.orders, revenue: kpi.revenue, items: kpi.items, aov: kpi.orders ? Math.round(kpi.revenue / kpi.orders) : 0 },
      byStatus: (f.byStatus || []).map(s => ({ status: s._id || '—', count: s.n })),
      topProducts: (f.topProducts || []).map(p => ({ name: p._id, qty: p.qty, revenue: p.revenue })),
      recentOrders
    });
  } catch (e) { next(e); }
});

// ---------- online store content (themes / articles / pages / menus) ----------
const CONTENT_COLS = { themes: 'themes', articles: 'articles', pages: 'pages', menus: 'menus' };
function contentCol(type) { return CONTENT_COLS[type] ? col(CONTENT_COLS[type]) : null; }
router.get('/content/:type', async (req, res, next) => {
  try {
    const c = contentCol(req.params.type);
    if (!c) return res.status(400).json({ error: 'bad type' });
    const q = (req.query.q || '').trim();
    const status = (req.query.status || '').trim();
    const and = [];
    if (q) and.push({ $or: [{ name: { $regex: q, $options: 'i' } }, { title: { $regex: q, $options: 'i' } }, { category: { $regex: q, $options: 'i' } }] });
    if (status) and.push({ status: status });
    const filter = and.length ? { $and: and } : {};
    const items = await c.find(filter).sort({ isCurrent: -1, updatedAt: -1 }).limit(200).toArray();
    res.json({ items, total: items.length });
  } catch (e) { next(e); }
});
// đặt giao diện làm giao diện chính (chỉ app local)
router.post('/content/themes/:id/apply', async (req, res, next) => {
  try {
    const c = contentCol('themes');
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const doc = await c.findOne({ _id });
    if (!doc) return res.status(404).json({ error: 'not found' });
    await c.updateMany({}, { $set: { isCurrent: false } });
    await c.updateOne({ _id }, { $set: { isCurrent: true, status: 'Đang dùng', updatedAt: new Date() } });
    res.json({ applied: String(_id), name: doc.name });
  } catch (e) { next(e); }
});
router.post('/content/:type', async (req, res, next) => {
  try {
    const c = contentCol(req.params.type);
    if (!c) return res.status(400).json({ error: 'bad type' });
    const b = req.body || {};
    const doc = { name: String(b.name || b.title || 'Mới').trim(), title: String(b.title || b.name || 'Mới').trim(), status: String(b.status || 'Bản nháp') };
    if (req.params.type === 'pages') { doc.path = String(b.path || ''); doc.excerpt = String(b.excerpt || b.content || ''); }
    if (req.params.type === 'menus') {
      doc.location = String(b.location || 'Main Menu');
      doc.items = Array.isArray(b.items) ? b.items.map(it => ({ label: String((it || {}).label || ''), link: String((it || {}).link || '') })) : [];
      doc.itemsCount = b.itemsCount !== undefined ? toNum(b.itemsCount) : doc.items.length;
    }
    if (req.params.type === 'themes') {
      doc.version = String(b.version || '1.0.0');
      doc.isCurrent = false;
      doc.thumbnail = String(b.thumbnail || '');
      doc.role = String(b.role || 'Chưa dùng');
    }
    if (req.params.type === 'articles') {
      doc.author = String(b.author || 'Quản trị viên');
      doc.views = toNum(b.views);
      doc.category = String(b.category || 'Tin tức - Sự kiện');
      doc.tag = String(b.tag || '---');
      doc.thumbnail = String(b.thumbnail || '');
      doc.publishedAt = b.publishedAt ? new Date(b.publishedAt) : new Date();
      doc.excerpt = String(b.excerpt || '');
    }
    doc.updatedAt = new Date();
    const r = await c.insertOne(doc);
    res.status(201).json(Object.assign({ _id: r.insertedId }, doc));
  } catch (e) { next(e); }
});
router.put('/content/:type/:id', async (req, res, next) => {
  try {
    const c = contentCol(req.params.type);
    if (!c) return res.status(400).json({ error: 'bad type' });
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const b = req.body || {};
    const upd = { updatedAt: new Date() };
    for (const k of ['name', 'title', 'status', 'path', 'location', 'author', 'version', 'category', 'tag', 'thumbnail', 'excerpt', 'role']) if (b[k] !== undefined) upd[k] = String(b[k]);
    if (b.itemsCount !== undefined) upd.itemsCount = toNum(b.itemsCount);
    if (Array.isArray(b.items)) {
      upd.items = b.items.map(it => ({ label: String((it || {}).label || ''), link: String((it || {}).link || '') }));
      if (b.itemsCount === undefined) upd.itemsCount = upd.items.length;
    }
    if (b.publishedAt !== undefined) upd.publishedAt = b.publishedAt ? new Date(b.publishedAt) : null;
    if (b.isCurrent !== undefined) upd.isCurrent = !!b.isCurrent;
    const r = await c.findOneAndUpdate({ _id }, { $set: upd }, { returnDocument: 'after' });
    const doc = r && r.value !== undefined ? r.value : r;
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (e) { next(e); }
});
router.delete('/content/:type/:id', async (req, res, next) => {
  try {
    const c = contentCol(req.params.type);
    if (!c) return res.status(400).json({ error: 'bad type' });
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const r = await c.deleteOne({ _id });
    res.json({ deleted: r.deletedCount });
  } catch (e) { next(e); }
});

// ---------- sàn TMĐT: sản phẩm/listing theo kênh (Shopee / Tiki) ----------
router.get('/channel-listings', async (req, res, next) => {
  try {
    const channel = String(req.query.channel || '');
    const q = (req.query.q || '').trim();
    const and = [];
    if (channel) and.push({ channel });
    if (q) and.push({ $or: [{ title: { $regex: q, $options: 'i' } }, { sku: { $regex: q, $options: 'i' } }, { shop: { $regex: q, $options: 'i' } }] });
    const items = await col('channelListings').find(and.length ? { $and: and } : {}).sort({ updatedAt: -1 }).toArray();
    const shops = await col('channelShops').find(channel ? { channel } : {}).toArray();
    res.json({ items, total: items.length, shops });
  } catch (e) { next(e); }
});
router.put('/channel-listings/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const b = req.body || {};
    const upd = { updatedAt: new Date() };
    for (const k of ['linkStatus', 'syncStatus', 'status', 'sku', 'variantSku', 'title', 'shop']) if (b[k] !== undefined) upd[k] = String(b[k]);
    const r = await col('channelListings').findOneAndUpdate({ _id }, { $set: upd }, { returnDocument: 'after' });
    const doc = r && r.value !== undefined ? r.value : r;
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (e) { next(e); }
});
router.post('/channel-listings/:id/sync', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const doc = await col('channelListings').findOne({ _id });
    if (!doc) return res.status(404).json({ error: 'not found' });
    const nextStatus = doc.channel === 'Tiki' ? 'Đồng bộ thành công' : 'Đồng bộ thành công';
    const r = await col('channelListings').findOneAndUpdate({ _id }, {
      $set: {
        syncStatus: nextStatus, linkStatus: 'Đã liên kết', status: 'Đang hoạt động',
        syncedAt: new Date(), updatedAt: new Date()
      }
    }, { returnDocument: 'after' });
    const out = r && r.value !== undefined ? r.value : r;
    res.json(out);
  } catch (e) { next(e); }
});

// ---------- product collections (nhóm sản phẩm) ----------
router.get('/collections', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const filter = q ? { name: { $regex: q, $options: 'i' } } : {};
    const items = await col('collections').find(filter).sort({ createdAt: -1 }).toArray();
    const counts = await col('products').aggregate([
      { $match: { collectionId: { $ne: null } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$collectionId', n: { $sum: 1 }, image: { $first: '$image' } } }
    ]).toArray();
    const map = {};
    counts.forEach(c => { map[String(c._id)] = c; });
    res.json({ items: items.map(c => Object.assign({}, c, { productCount: (map[String(c._id)] || {}).n || 0, image: (map[String(c._id)] || {}).image || null })), total: items.length });
  } catch (e) { next(e); }
});
router.post('/collections', async (req, res, next) => {
  try {
    const b = req.body || {};
    const doc = { name: String(b.name || 'Nhóm mới').trim(), condition: String(b.condition || ''), description: String(b.description || ''), createdAt: new Date() };
    const r = await col('collections').insertOne(doc);
    res.status(201).json(Object.assign({ _id: r.insertedId, productCount: 0 }, doc));
  } catch (e) { next(e); }
});
router.get('/collections/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const collection = await col('collections').findOne({ _id });
    if (!collection) return res.status(404).json({ error: 'not found' });
    const products = await col('products').find({ collectionId: _id }).sort({ name: 1 }).toArray();
    res.json({ collection, products });
  } catch (e) { next(e); }
});
router.put('/collections/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const b = req.body || {};
    const upd = {};
    for (const k of ['name', 'condition', 'description']) if (b[k] !== undefined) upd[k] = String(b[k]);
    const r = await col('collections').findOneAndUpdate({ _id }, { $set: upd }, { returnDocument: 'after' });
    const doc = r && r.value !== undefined ? r.value : r;
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (e) { next(e); }
});
router.delete('/collections/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const r = await col('collections').deleteOne({ _id });
    res.json({ deleted: r.deletedCount });
  } catch (e) { next(e); }
});

// ---------- price lists (bảng giá) ----------
router.get('/price-lists', async (req, res, next) => {
  try {
    const items = await col('priceLists').find({}).sort({ createdAt: -1 }).toArray();
    res.json({ items, total: items.length });
  } catch (e) { next(e); }
});
router.post('/price-lists', async (req, res, next) => {
  try {
    const b = req.body || {};
    const doc = { name: String(b.name || 'Bảng giá mới').trim(), type: String(b.type || 'Bán lẻ'), adjustType: String(b.adjustType || '%'), adjustValue: toNum(b.adjustValue), applyTo: String(b.applyTo || 'Tất cả sản phẩm'), active: b.active !== false, createdAt: new Date() };
    const r = await col('priceLists').insertOne(doc);
    res.status(201).json(Object.assign({ _id: r.insertedId }, doc));
  } catch (e) { next(e); }
});
router.put('/price-lists/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const b = req.body || {};
    const upd = {};
    for (const k of ['name', 'type', 'adjustType', 'applyTo']) if (b[k] !== undefined) upd[k] = String(b[k]);
    if (b.adjustValue !== undefined) upd.adjustValue = toNum(b.adjustValue);
    if (b.active !== undefined) upd.active = !!b.active;
    const r = await col('priceLists').findOneAndUpdate({ _id }, { $set: upd }, { returnDocument: 'after' });
    const doc = r && r.value !== undefined ? r.value : r;
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (e) { next(e); }
});
router.delete('/price-lists/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const r = await col('priceLists').deleteOne({ _id });
    res.json({ deleted: r.deletedCount });
  } catch (e) { next(e); }
});

// ---------- apps (ứng dụng) ----------
router.get('/apps', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const filter = q ? { $or: [{ name: { $regex: q, $options: 'i' } }, { category: { $regex: q, $options: 'i' } }] } : {};
    const items = await col('apps').find(filter).sort({ installedAt: -1 }).toArray();
    res.json({ items, total: items.length });
  } catch (e) { next(e); }
});
router.put('/apps/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const b = req.body || {};
    const upd = {};
    if (b.status !== undefined) { upd.status = String(b.status); upd.installedAt = /Đã cài/.test(upd.status) ? new Date() : null; }
    const r = await col('apps').findOneAndUpdate({ _id }, { $set: upd }, { returnDocument: 'after' });
    const doc = r && r.value !== undefined ? r.value : r;
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (e) { next(e); }
});

// ---------- generic CRUD (locations / staff / roles / groups) ----------
function crudRoutes(path, colName, strKeys, numKeys, boolKeys, dateKeys) {
  router.get(path, async (req, res, next) => {
    try {
      const q = (req.query.q || '').trim();
      const filter = q ? { $or: strKeys.map(k => ({ [k]: { $regex: q, $options: 'i' } })) } : {};
      const items = await col(colName).find(filter).sort({ createdAt: -1 }).limit(200).toArray();
      res.json({ items, total: items.length });
    } catch (e) { next(e); }
  });
  router.post(path, async (req, res, next) => {
    try {
      const b = req.body || {};
      const doc = {};
      strKeys.forEach(k => { doc[k] = String(b[k] || ''); });
      (numKeys || []).forEach(k => { doc[k] = toNum(b[k]); });
      (boolKeys || []).forEach(k => { doc[k] = !!b[k]; });
      (dateKeys || []).forEach(k => { doc[k] = b[k] ? new Date(b[k]) : null; });
      doc.createdAt = new Date();
      const r = await col(colName).insertOne(doc);
      res.status(201).json(Object.assign({ _id: r.insertedId }, doc));
    } catch (e) { next(e); }
  });
  router.put(path + '/:id', async (req, res, next) => {
    try {
      const _id = oid(req.params.id);
      if (!_id) return res.status(400).json({ error: 'bad id' });
      const b = req.body || {};
      const upd = {};
      strKeys.forEach(k => { if (b[k] !== undefined) upd[k] = String(b[k]); });
      (numKeys || []).forEach(k => { if (b[k] !== undefined) upd[k] = toNum(b[k]); });
      (boolKeys || []).forEach(k => { if (b[k] !== undefined) upd[k] = !!b[k]; });
      (dateKeys || []).forEach(k => { if (b[k] !== undefined) upd[k] = b[k] ? new Date(b[k]) : null; });
      const r = await col(colName).findOneAndUpdate({ _id }, { $set: upd }, { returnDocument: 'after' });
      const doc = r && r.value !== undefined ? r.value : r;
      if (!doc) return res.status(404).json({ error: 'not found' });
      res.json(doc);
    } catch (e) { next(e); }
  });
  router.delete(path + '/:id', async (req, res, next) => {
    try {
      const _id = oid(req.params.id);
      if (!_id) return res.status(400).json({ error: 'bad id' });
      const r = await col(colName).deleteOne({ _id });
      res.json({ deleted: r.deletedCount });
    } catch (e) { next(e); }
  });
}

crudRoutes('/locations', 'locations', ['name', 'address', 'phone', 'email', 'legacyId'], ['inventory'], ['isDefault']);
crudRoutes('/staff', 'staff', ['name', 'email', 'role', 'access', 'location'], [], []);
crudRoutes('/roles', 'roles', ['name', 'code', 'creator', 'description'], [], []);
crudRoutes('/groups', 'groups', ['name', 'note'], ['members'], []);
crudRoutes('/payment-methods', 'paymentMethods', ['name', 'type', 'provider', 'note'], ['fee'], ['enabled']);
crudRoutes('/shipping-carriers', 'shippingCarriers', ['name', 'code', 'note'], ['fee', 'freeThreshold'], ['enabled']);
crudRoutes('/domains', 'domains', ['name', 'status'], [], ['primary']);
crudRoutes('/email-templates', 'emailTemplates', ['name', 'event', 'subject'], [], ['enabled']);
crudRoutes('/files', 'files', ['name', 'path', 'type'], ['size'], []);

// upload tệp thật vào haravan_dashboard_html/assets/uploads
router.post('/files/upload', async (req, res, next) => {
  try {
    const b = req.body || {};
    const name = String(b.name || 'tep-moi').replace(/[^\w.\-]+/g, '_');
    const data = String(b.data || '');
    const m = data.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: 'Dữ liệu tệp không hợp lệ' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 20 * 1024 * 1024) return res.status(413).json({ error: 'Tệp quá lớn (tối đa 20MB)' });
    const dir = path.join(__dirname, '..', '..', 'haravan_dashboard_html', 'assets', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = Date.now();
    const fileName = stamp + '_' + name;
    fs.writeFileSync(path.join(dir, fileName), buf);
    const doc = { name: name, path: 'assets/uploads/' + fileName, type: (name.split('.').pop() || '').toUpperCase(), size: buf.length, createdAt: new Date() };
    const r = await col('files').insertOne(doc);
    res.status(201).json(Object.assign({ _id: r.insertedId }, doc));
  } catch (e) { next(e); }
});
router.delete('/files/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const doc = await col('files').findOne({ _id });
    if (doc && /^assets\/uploads\//.test(String(doc.path || ''))) {
      const fp = path.join(__dirname, '..', '..', 'haravan_dashboard_html', doc.path);
      try { fs.unlinkSync(fp); } catch (e) { }
    }
    const r = await col('files').deleteOne({ _id });
    res.json({ deleted: r.deletedCount });
  } catch (e) { next(e); }
});crudRoutes('/invoices', 'invoices', ['name', 'type', 'paidAt'], ['amount'], []);
crudRoutes('/debts', 'debts', ['name'], ['opening', 'incurred', 'paid', 'closing'], []);
crudRoutes('/suppliers', 'suppliers', ['name', 'status', 'phone', 'email'], ['debt', 'totalPurchase'], []);
crudRoutes('/stock-receipts', 'stockReceipts', ['code', 'supplier', 'location', 'status'], ['qty', 'total', 'debt'], [], ['receivedAt']);
crudRoutes('/purchase-returns', 'purchaseReturns', ['code', 'refCode', 'supplier', 'location', 'status'], ['qty', 'supplierPayable', 'supplierDebt'], [], ['returnedAt']);
crudRoutes('/stock-takes', 'stockTakes', ['code', 'location', 'status'], ['diffQty', 'diffValue'], [], ['takenAt', 'balancedAt']);
crudRoutes('/transfers', 'transfers', ['code', 'location', 'status'], ['qty'], [], ['expectedAt']);
crudRoutes('/stock-activities', 'stockActivities', ['code', 'type', 'product', 'location'], ['onHand', 'onOrder', 'incoming', 'price', 'total'], []);
crudRoutes('/drafts', 'drafts', ['code', 'customer', 'region', 'status', 'channel', 'pageKey'], ['total', 'itemsCount'], []);
crudRoutes('/reviews', 'reviews', ['product', 'customer', 'comment', 'status'], ['rating'], []);
crudRoutes('/flows', 'flows', ['name', 'trigger', 'action', 'status'], ['runs'], []);
crudRoutes('/broadcasts', 'broadcasts', ['name', 'channel', 'status'], ['recipients', 'opened'], []);
crudRoutes('/checkouts', 'checkouts', ['code', 'customer', 'region', 'status', 'channel'], ['total', 'itemsCount'], []);
crudRoutes('/purchase-orders', 'purchaseOrders', ['code', 'supplier', 'location', 'status'], ['qty', 'total'], [], ['expectedAt']);

// ---------- generic config documents (vat, notifications, checkouts, ...) ----------
router.get('/config/:key', async (req, res, next) => {
  try {
    const doc = await col('configs').findOne({ key: String(req.params.key) });
    res.json(doc || { key: String(req.params.key) });
  } catch (e) { next(e); }
});
router.put('/config/:key', async (req, res, next) => {
  try {
    const key = String(req.params.key);
    const b = req.body || {};
    const upd = Object.assign({}, b); delete upd._id; delete upd.key;
    upd.updatedAt = new Date();
    const r = await col('configs').findOneAndUpdate({ key }, { $set: upd, $setOnInsert: { key } }, { upsert: true, returnDocument: 'after' });
    const doc = r && r.value !== undefined ? r.value : r;
    res.json(doc);
  } catch (e) { next(e); }
});

// ---------- shipments (derived from orders) ----------
router.get('/shipments', async (req, res, next) => {
  try {
    const bucket = String(req.query.bucket || 'all');
    const page = Math.max(1, toNum(req.query.page) || 1);
    const limit = Math.min(200, toNum(req.query.limit) || 50);
    const q = (req.query.q || '').trim();
    const status = (req.query.status || '').trim();
    const carrier = (req.query.carrier || '').trim();
    let filter = {};
    if (bucket === 'cod') filter = { cod: { $gt: 0 } };
    else if (bucket === 'packed') filter = { fulfillmentStatus: 'Chưa giao hàng' };
    else if (bucket === 'handover') filter = { fulfillmentStatus: 'Đang giao hàng' };
    else if (bucket === 'return') filter = { fulfillmentStatus: 'Đã huỷ' };
    if (req.query.legacy) filter.legacyId = toNum(req.query.legacy);
    if (req.query.cod === '1') filter.cod = { $gt: 0 };
    if (req.query.archived !== '1') filter.archived = { $ne: true };
    if (status) filter.fulfillmentStatus = status;
    if (carrier) filter.shippingCarrier = carrier;
    if (q) {
      const re = { $regex: q, $options: 'i' };
      const or = [{ code: re }, { trackingNumber: re }, { trackingCode: re }, { customerName: re }, { phone: re }];
      filter.$or = or;
    }
    const total = await col('orders').countDocuments(filter);
    const items = await col('orders').find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray();
    const byCarrier = await col('orders').aggregate([
      { $match: filter },
      { $group: { _id: '$shippingCarrier', orders: { $sum: 1 }, cod: { $sum: { $ifNull: ['$cod', 0] } } } },
      { $sort: { orders: -1 } }
    ]).toArray();
    const codAgg = await col('orders').aggregate([
      { $match: { cod: { $gt: 0 } } },
      { $group: { _id: null, n: { $sum: 1 }, sum: { $sum: '$cod' } } }
    ]).toArray();
    res.json({
      items, total, page, pages: Math.ceil(total / limit), limit,
      byCarrier: byCarrier.map(c => ({ carrier: c._id || '—', orders: c.orders, cod: c.cod })),
      cod: codAgg[0] || { n: 0, sum: 0 }
    });
  } catch (e) { next(e); }
});

// ---------- inventory (derived from products) ----------
function inventoryFilter(req) {
  const q = (req.query.q || '').trim();
  const filter = q ? { $or: [{ name: { $regex: q, $options: 'i' } }, { sku: { $regex: q, $options: 'i' } }] } : {};
  const stock = String(req.query.stock || '');
  if (stock === 'pos' || stock === 'gt0') filter.stock = { $gt: 0 };
  else if (stock === 'zero' || stock === 'eq0') filter.stock = 0;
  else if (stock === 'neg' || stock === 'lt0') filter.stock = { $lt: 0 };
  return filter;
}
async function defaultLocationName() {
  const loc = await col('locations').findOne({ isDefault: true });
  return (loc && loc.name) || '—';
}
// KPI của trang "Chi tiết tồn kho" (Tổng lượng tồn / giá bán / giá trị / lợi nhuận)
router.get('/inventory/summary', async (req, res, next) => {
  try {
    const agg = await col('products').aggregate([
      { $match: inventoryFilter(req) },
      { $group: { _id: null, qty: { $sum: { $ifNull: ['$stock', 0] } }, sell: { $sum: { $multiply: [{ $ifNull: ['$stock', 0] }, { $ifNull: ['$price', 0] }] } }, value: { $sum: { $multiply: [{ $ifNull: ['$stock', 0] }, { $ifNull: ['$cost', 0] }] } }, n: { $sum: 1 } } }
    ]).toArray();
    const g = agg[0] || { qty: 0, sell: 0, value: 0, n: 0 };
    res.json({ qty: g.qty, sell: g.sell, value: g.value, profit: g.sell - g.value, total: g.n });
  } catch (e) { next(e); }
});
router.get('/inventory', async (req, res, next) => {
  try {
    const page = Math.max(1, toNum(req.query.page) || 1);
    const limit = Math.min(200, toNum(req.query.limit) || 50);
    const filter = inventoryFilter(req);
    const locName = await defaultLocationName();
    const total = await col('products').countDocuments(filter);
    const rows = await col('products').find(filter).sort({ stock: 1 }).skip((page - 1) * limit).limit(limit).toArray();
    const items = rows.map(p => Object.assign({}, p, { location: p.location || locName }));
    res.json({ items, total, page, pages: Math.ceil(total / limit), limit });
  } catch (e) { next(e); }
});

// ---------- discounts ----------
router.get('/discounts', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(1, toNum(req.query.page) || 1);
    const limit = Math.min(200, toNum(req.query.limit) || 50);
    const filter = q ? { $or: [{ name: { $regex: q, $options: 'i' } }, { code: { $regex: q, $options: 'i' } }] } : {};
    if (req.query.legacy) filter.legacyId = toNum(req.query.legacy);
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.activated === '1') filter.status = 'Đang hoạt động';
    else if (req.query.activated === '0') filter.status = { $ne: 'Đang hoạt động' };
    if (req.query.form) filter.form = String(req.query.form);
    if (req.query.display) filter.display = String(req.query.display);
    const total = await col('discounts').countDocuments(filter);
    const items = await col('discounts').find(filter).sort({ _id: -1 }).skip((page - 1) * limit).limit(limit).toArray();
    res.json({ items, total, page, pages: Math.ceil(total / limit), limit });
  } catch (e) { next(e); }
});
router.post('/discounts', async (req, res, next) => {
  try {
    const b = req.body || {};
    const doc = {
      name: String(b.name || 'Khuyến mãi mới'), code: String(b.code || ('SALE' + Date.now())),
      form: String(b.form || 'Giảm theo %'), type: String(b.type || 'Mã giảm giá'),
      status: String(b.status || 'Đang hoạt động'), display: String(b.display || 'Công khai'),
      used: toNum(b.used), value: toNum(b.value), startsAt: b.startsAt ? new Date(b.startsAt) : new Date(),
      endsAt: b.endsAt ? new Date(b.endsAt) : new Date(Date.now() + 30 * 86400000), createdAt: new Date()
    };
    const r = await col('discounts').insertOne(doc);
    res.status(201).json(Object.assign({ _id: r.insertedId }, doc));
  } catch (e) { next(e); }
});
router.put('/discounts/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const b = req.body || {};
    const upd = {};
    for (const k of ['name', 'code', 'form', 'type', 'status', 'display', 'note']) if (b[k] !== undefined) upd[k] = String(b[k]);
    if (b.showSuggestion !== undefined) upd.showSuggestion = !!b.showSuggestion;
    for (const k of ['used', 'value']) if (b[k] !== undefined) upd[k] = toNum(b[k]);
    if (b.startsAt) upd.startsAt = new Date(b.startsAt);
    if (b.endsAt) upd.endsAt = new Date(b.endsAt);
    const r = await col('discounts').findOneAndUpdate({ _id }, { $set: upd }, { returnDocument: 'after' });
    const doc = r && r.value !== undefined ? r.value : r;
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (e) { next(e); }
});
router.delete('/discounts/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const r = await col('discounts').deleteOne({ _id });
    res.json({ deleted: r.deletedCount });
  } catch (e) { next(e); }
});

// ---------- transactions (accounting) ----------
router.get('/transactions/summary', async (req, res, next) => {
  try {
    const agg = await col('transactions').aggregate([{ $group: { _id: '$type', total: { $sum: '$amount' }, n: { $sum: 1 } } }]).toArray();
    let thu = 0, chi = 0, count = 0;
    agg.forEach(function (g) { if (g._id === 'Thu') thu = g.total; else if (g._id === 'Chi') chi = g.total; count += g.n; });
    res.json({ thu: thu, chi: chi, balance: thu - chi, count: count });
  } catch (e) { next(e); }
});
router.get('/transactions', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(1, toNum(req.query.page) || 1);
    const limit = Math.min(200, toNum(req.query.limit) || 50);
    const filter = q ? { $or: [{ code: { $regex: q, $options: 'i' } }, { reason: { $regex: q, $options: 'i' } }, { party: { $regex: q, $options: 'i' } }] } : {};
    if (req.query.type) filter.type = String(req.query.type);
    if (req.query.legacy) filter.legacyId = toNum(req.query.legacy);
    const total = await col('transactions').countDocuments(filter);
    const items = await col('transactions').find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(limit).toArray();
    res.json({ items, total, page, pages: Math.ceil(total / limit), limit });
  } catch (e) { next(e); }
});
router.post('/transactions', async (req, res, next) => {
  try {
    const b = req.body || {};
    const doc = { code: String(b.code || ('PT' + Date.now())), type: String(b.type || 'Thu'), reason: String(b.reason || ''), party: String(b.party || ''), amount: toNum(b.amount), note: String(b.note || ''), date: b.date ? new Date(b.date) : new Date(), createdAt: new Date() };
    const r = await col('transactions').insertOne(doc);
    res.status(201).json(Object.assign({ _id: r.insertedId }, doc));
  } catch (e) { next(e); }
});
router.put('/transactions/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const b = req.body || {};
    const upd = {};
    for (const k of ['code', 'type', 'reason', 'party', 'note']) if (b[k] !== undefined) upd[k] = String(b[k]);
    if (b.amount !== undefined) upd.amount = toNum(b.amount);
    if (b.date) upd.date = new Date(b.date);
    const r = await col('transactions').findOneAndUpdate({ _id }, { $set: upd }, { returnDocument: 'after' });
    const doc = r && r.value !== undefined ? r.value : r;
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (e) { next(e); }
});
router.delete('/transactions/:id', async (req, res, next) => {
  try {
    const _id = oid(req.params.id);
    if (!_id) return res.status(400).json({ error: 'bad id' });
    const r = await col('transactions').deleteOne({ _id });
    res.json({ deleted: r.deletedCount });
  } catch (e) { next(e); }
});

// ---------- settings ----------
router.get('/settings', async (req, res, next) => {
  try {
    const d = await col('settings').findOne({ key: 'site' });
    res.json(d || {});
  } catch (e) { next(e); }
});
router.put('/settings', async (req, res, next) => {
  try {
    const b = req.body || {};
    const upd = {};
    for (const k of ['storeName', 'phone', 'email', 'address', 'currency', 'accountEmail', 'taxId', 'website', 'note']) if (b[k] !== undefined) upd[k] = String(b[k]);
    upd.updatedAt = new Date();
    await col('settings').updateOne({ key: 'site' }, { $set: upd }, { upsert: true });
    const d = await col('settings').findOne({ key: 'site' });
    res.json(d);
  } catch (e) { next(e); }
});

// ---------- reports ----------
router.get('/stats/reports', async (req, res, next) => {
  try {
    if (String(req.query.source) === 'snapshot') {
      const fs = require('fs');
      const p = require('path').join(__dirname, '..', 'data', 'report-snapshot.json');
      const s = JSON.parse(fs.readFileSync(p, 'utf8'));
      return res.json({
        revenue: s.kpi.revenue, revenueNet: s.kpi.net, paid: s.kpi.paid, discount: s.kpi.discount, orders: s.kpi.orders,
        byChannel: s.byChannel, byTraffic: s.byTraffic, byStaff: s.byStaff, byStatus: s.byStatus,
        topProducts: s.topProducts, topCustomers: s.topCustomers || [], tx: [],
        series: s.series, seriesOrders: s.seriesOrders, hourly: s.hourly,
        compare: null, prev: null, snapshot: true
      });
    }
    const match = {};
    let from = req.query.from ? new Date(req.query.from) : null;
    let to = req.query.to ? new Date(new Date(req.query.to).getTime() + 86400000 - 1) : null;
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = from;
      if (to) match.createdAt.$lte = to;
    }
    if (req.query.channel) match.channel = req.query.channel;
    if (req.query.region) match.shippingAddress = new RegExp(String(req.query.region).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const orders = col('orders');
    const byChannel = await orders.aggregate([{ $match: match }, { $group: { _id: '$channel', total: { $sum: '$total' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]).toArray();
    const byTraffic = await orders.aggregate([{ $match: match }, { $group: { _id: '$trafficSource', total: { $sum: '$total' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]).toArray();
    const byStaff = await orders.aggregate([{ $match: match }, { $group: { _id: '$salesStaff', total: { $sum: '$total' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }, { $limit: 6 }]).toArray();
    const byStatus = await orders.aggregate([{ $match: match }, { $group: { _id: '$fulfillmentStatus', count: { $sum: 1 } } }, { $sort: { count: -1 } }]).toArray();
    const topProducts = await orders.aggregate([{ $match: match }, { $unwind: '$items' }, { $group: { _id: '$items.name', qty: { $sum: '$items.qty' }, revenue: { $sum: '$items.subtotal' } } }, { $sort: { revenue: -1 } }, { $limit: 5 }]).toArray();
    const sum = await orders.aggregate([{ $match: match }, { $group: { _id: null, s: { $sum: '$total' }, net: { $sum: { $subtract: ['$total', { $ifNull: ['$refundedAmount', 0] }] } }, n: { $sum: 1 }, paid: { $sum: { $ifNull: ['$paidAmount', 0] } }, disc: { $sum: { $ifNull: ['$discountAmount', 0] } } } }]).next();
    const topCustomers = await col('customers').find({}).sort({ totalSpent: -1 }).limit(5).toArray();
    const tx = await col('transactions').aggregate([{ $group: { _id: '$type', total: { $sum: '$amount' } } }]).toArray();
    const series = await orders.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%d/%m/%Y', date: '$createdAt' } }, value: { $sum: { $subtract: ['$total', { $ifNull: ['$refundedAmount', 0] }] } }, d: { $min: '$createdAt' } } },
      { $sort: { d: 1 } }
    ]).toArray();
    const seriesHour = await orders.aggregate([
      { $match: match },
      { $group: { _id: { $hour: '$createdAt' }, value: { $sum: { $subtract: ['$total', { $ifNull: ['$refundedAmount', 0] }] } } } },
      { $sort: { _id: 1 } }
    ]).toArray();
    const hourMap = new Map(seriesHour.map(h => [h._id, h.value]));
    const hourly = Array.from({ length: 24 }, (_, h) => ({ label: String(h).padStart(2, '0') + ':00', value: hourMap.get(h) || 0 }));
    const seriesOrders = await orders.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%d/%m/%Y', date: '$createdAt' } }, value: { $sum: 1 }, d: { $min: '$createdAt' } } },
      { $sort: { d: 1 } }
    ]).toArray();
    const topProductsWithImg = topProducts.slice();
    try {
      const prods = await col('products').find({ name: { $in: topProductsWithImg.map(p => p._id) } }).project({ name: 1, image: 1, images: 1 }).toArray();
      const imgMap = new Map(prods.map(p => [p.name, p.image || (p.images && p.images[0]) || null]));
      topProductsWithImg.forEach(p => { p.image = imgMap.get(p._id) || null; });
    } catch (e) { /* thumbnail không bắt buộc */ }

    // so sánh kỳ trước / cùng kỳ năm trước
    let prev = null;
    const compare = String(req.query.compare || '');
    if (compare && from && to) {
      const span = to.getTime() - from.getTime() + 1;
      let pf, pt;
      if (compare === 'year') { pf = new Date(from); pf.setFullYear(pf.getFullYear() - 1); pt = new Date(to); pt.setFullYear(pt.getFullYear() - 1); }
      else { pf = new Date(from.getTime() - span); pt = new Date(from.getTime() - 1); }
      const p = await orders.aggregate([{ $match: { createdAt: { $gte: pf, $lte: pt } } }, { $group: { _id: null, s: { $sum: '$total' }, net: { $sum: { $subtract: ['$total', { $ifNull: ['$refundedAmount', 0] }] } }, n: { $sum: 1 } } }]).next();
      prev = { revenue: p ? p.s : 0, revenueNet: p ? p.net : 0, orders: p ? p.n : 0 };
    }

    res.json({
      revenue: sum ? sum.s : 0,
      revenueNet: sum ? sum.net : 0,
      paid: sum ? sum.paid : 0,
      discount: sum ? sum.disc : 0,
      orders: sum ? sum.n : 0,
      byChannel, byTraffic, byStaff, byStatus, topProducts: topProductsWithImg, topCustomers, tx,
      series: series.map(s => ({ label: s._id, value: s.value })),
      seriesOrders: seriesOrders.map(s => ({ label: s._id, value: s.value })),
      hourly,
      compare: compare || null, prev
    });
  } catch (e) { next(e); }
});

// error handler
router.use((err, req, res, next) => {
  console.error('API ERROR', err);
  res.status(500).json({ error: err.message });
});

module.exports = router;
