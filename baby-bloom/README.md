# 🌸 BABY BLOOM — Baby Care & Mother Care D2C

**Project 15 · Baby D2C · Complete ready product.** A MERN stack store built to the project brief:

| Item | What the brief asks for | What is built |
|---|---|---|
| **Category** | Baby D2C | Baby care and mother care: Bath & Skin, Diapering, Feeding, Clothing, Toys, Mom Care |
| **Stack** | React.js (Vite) · Node.js · Express · MongoDB (Mongoose) · JWT · Razorpay/Stripe · Cloudinary | All of these, and nothing else in the product |
| **UI** | Premium luxury · minimal · mobile-first responsive | Pastel luxury theme (Fraunces + Nunito), works on mobile, tablet and desktop |
| **Flow** | Browse → Cart → Checkout → Payment → Admin → Delivery → Invoice | Every step is built end to end (details below) |

---

## 1. Folder structure

The brief's required files are all present: `Home.jsx`, `Product.jsx`, `Cart.jsx`, `Checkout.jsx`, `Admin.jsx`, `Navbar.jsx`, `ProductCard.jsx`, `Hero.jsx`, `User.js`, `Product.js`, `Order.js`, `auth.js`, `products.js`, `orders.js`, `admin.js` and `server.js`. The files around them support the same flow.

```
baby-bloom/
├── frontend/src/
│   ├── pages/        Home.jsx, Product.jsx, Cart.jsx, Checkout.jsx, Admin.jsx,
│   │                 Shop.jsx, Login.jsx, Orders.jsx, OrderDetail.jsx, Account.jsx
│   ├── components/   Navbar.jsx, ProductCard.jsx, Hero.jsx,
│   │                 CartDrawer, SearchBox, AddressForm, QtyStepper, StatusBadge, Toast, Footer
│   └── context/      AuthContext (JWT), CartContext
└── backend/
    ├── server.js
    ├── src/models/   User.js, Product.js, Order.js, Coupon, Banner, InventoryLog, Counter
    ├── src/routes/   auth.js, products.js, orders.js, admin.js, payments, coupons, me, events
    ├── src/services/ pricing, orderOps (stock · payment · refunds), invoice, label, notify, events, serviceability
    ├── src/lib/      couponRules, gst, refunds, couriers   (pure, unit-tested rules)
    └── test/         node:test suites (24 tests)
```

## 2. Backend `server.js`

This is the brief's Express server, with the same routes (`/api/auth`, `/api/products`, `/api/orders`, `/api/admin`) on port 5000. It adds:
- Helmet security headers and CORS
- Rate-limited login and payment endpoints
- A NoSQL-injection guard
- Raw-body routes for the **Razorpay** and **Stripe** webhooks
- A larger upload limit for **Cloudinary** images
- Clean JSON error messages

## 3. MongoDB models

- **Product.js:** the brief's exact fields, including `rating` default 4.8 and `isBestseller`. Added for the catalogue, stock and invoice: `slug`, `sku`, `brand`, `size`, `ageGroup`, `features`, `hsn` and `lowStockThreshold`.
- **Order.js:** the brief's `user`, `items[{product, qty, price}]`, `total`, `status`, `payment{method, status}` and `address{name, phone, city, pincode}`. Extended with:
  - GST split (CGST/SGST/IGST and place of supply) and the invoice number
  - Shipping: courier, AWB, tracking URL and ETA
  - A timeline of status changes
  - Payment attempts, refunds and amount refunded
  - A log of email and WhatsApp notifications
- **User.js:** JWT login, an address book, the saved cart and WhatsApp opt-in. Supporting models: **Coupon**, **Banner**, **InventoryLog** (stock audit) and **Counter** (invoice numbering).

## 4. Premium UI — React + Tailwind

**Design idea: colour-coded aisles, like a nursery shelf.** Each category has its own pastel swatch, taken from muslin prints and wooden stacking blocks. The swatch is used everywhere that category appears (product photos, filters, the shop header, cart thumbnails), so parents always know which aisle they're in.

| Aisle | Swatch |
|---|---|
| Bath & Skin | sky `#CFE6F5` |
| Diapering | butter `#FBE7A1` |
| Feeding | mint `#CDEBD9` |
| Clothing | peach `#FAD4C0` |
| Toys | lilac `#E1D7F3` |
| Mom Care | rose `#F6CFD9` |

Base colours: cool milk-glass white `#F7F8FB` and deep navy `#1F2340`, with one cobalt `#2F4BD8` for actions and focus.

- **Type:** *Unbounded* for headlines (wide and chunky, like letters on toy blocks), always sentence case, paired with *Figtree* for body text.
- **Hero:** the admin's scheduled banners framed in an **arched nursery window**, with the six aisle blocks **stacked as a pyramid** at its foot. The blocks drop in one by one on page load; this is the only automatic animation on the site, and it's turned off for people who prefer reduced motion.
- **`ProductCard.jsx`:** the brief's card (rounded corners, image, name, category, ★ rating, price and MRP, Add to Cart). The product sits on its aisle colour like a studio shot on coloured paper. Hovering shows the second image, and the round **+** turns into a quantity stepper once the item is in the basket.
- **Basket:** the free-shipping progress is shown as ten toy blocks that fill up. The basket count in the header gives a small bump when something is added.
- **Accessibility:** visible keyboard focus everywhere, focus management in the drawer and lightbox, labelled controls, and reduced-motion support. Layouts are mobile-first and work on tablet and desktop.

## 5. End-to-end transaction flow

The brief's flow, step by step, with how each step is built:

| Step | Implementation |
|---|---|
| **Luxury home page** | A hero **carousel** of admin-managed banners. Each banner can have a start and end date, separate desktop and mobile images, autoplay that pauses on hover, swipe and keyboard controls, and reduced-motion support. Below it: category tiles, bestsellers and new arrivals. |
| **Browse** | Search with as-you-type suggestions and keyboard navigation. Filters for category, age group, price range, in stock and bestseller, plus sorting. |
| **PDP with premium images** | Thumbnail gallery with **hover zoom** that follows the cursor, a **fullscreen lightbox** (arrow keys, swipe, Esc) and Cloudinary images sized for each screen. Also: savings shown, low-stock urgency and a **pincode delivery check** with ETA. |
| **Add to cart** | A cart drawer plus a full cart page. The cart is **saved to the customer's account**, so it's there on any device and merges when they sign in. Opening the cart **re-checks live prices and stock** and lists anything that changed. |
| **Address** | An **address book** with multiple saved addresses, labels and a default. Entering a pincode fills in state and city automatically, and every field is validated. Express delivery is offered only where it's available. |
| **Razorpay/Stripe payment** | Razorpay Checkout with **HMAC signature verification** and a **webhook** (`payment.captured` / `payment.failed` / `refund.processed`). Stripe Checkout with session verification and a **webhook**. Payment confirmation can't run twice, and every attempt (paid, failed, dismissed, expired) is logged. Customers can retry payment from the order page. A demo gateway runs the full flow when no keys are set. |
| **Order created in MongoDB** | Prices, coupons and GST are **recalculated on the server**. Stock is reserved one item at a time with a check that prevents overselling. Coupon rules (first order, per customer, total uses, categories, dates) are checked against real order history. |
| **Admin dashboard gets live order** | **Server-Sent Events** push new orders, status changes and low-stock alerts instantly, with a sound and optional **desktop notifications**. The dashboard shows net revenue over 7, 30 or 90 days with growth against the previous period, average order value, repeat-buyer rate, sales by category, top sellers and low stock. |
| **Pack → Ship** | Bulk "Packed". Shipping opens a form for **courier + AWB** (Delhivery, Blue Dart, Ekart, DTDC, Xpressbees, India Post), which builds the courier's tracking link. **4×6 thermal shipping labels** include a scannable **Code 39 barcode**. |
| **Delivery tracking** | A live timeline on the customer's order page with the time of each step, the ETA (which skips Sundays and accounts for orders after 2 pm), and a **"Track with courier"** link. |
| **Invoice + Email/WhatsApp** | A **GST tax invoice** PDF with a gap-free number per financial year (`BB/2026-27/000042`), seller GSTIN, HSN per line, **CGST + SGST or IGST** by place of supply, and the amount in words. It's **attached to the order-confirmation email**. Branded HTML emails go out for every status change. **WhatsApp Business Cloud API** messages are sent when configured, otherwise customers get a click-to-chat link. Every send is recorded on the order, and admin can resend. |
| **Admin manages products** | Create and edit products with **Cloudinary multi-image upload** (drag and drop, reorder, set cover, remove, which also deletes from Cloudinary), price-vs-MRP checks and HSN/SKU. Deleting only hides a product, so order history stays intact. |
| **…banners** | Cloudinary upload, desktop and mobile images, start and end dates, live/scheduled status, and up/down reordering. |
| **…coupons** | Percent or flat, minimum order, maximum discount, first order only, uses per customer, total uses, category limits, start and end dates, shown or hidden at checkout. **Usage stats** per coupon: uses, discount given and revenue. |
| **…stock** | Stock value and low/out-of-stock totals, restock or remove with a reason and note, a low-stock alert level per product, and a full **stock movement log** (sale, cancel, refund, restock, damage, correction, with who did it). |
| **…refunds** | **Full, partial (per item) or custom-amount refunds** through the Razorpay or Stripe refund APIs. Each item's refund is its price minus its share of the discount, plus GST. Admin can choose to put refunded items back in stock. Refund history goes on the order, the invoice and the Refunds page. Unshipped paid orders are refunded automatically when cancelled. |
| **Fully responsive** | Mobile, tablet and desktop. |

## 6. Run instructions (5 min)

```bash
# 1. Backend
cd backend
cp .env.example .env        # MONGO_URI, JWT_SECRET, RAZORPAY_KEY (as in the brief) + optional keys
npm install
npm run seed                # 16 products, 4 coupons, 3 banners, admin user
npm run dev                 # → http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                 # → http://localhost:5173  (proxies /api to :5000)
```

- **Admin login:** `admin@babybloom.dev` / `Admin@123`
- **Coupons:** `BLOOM15` · `FIRSTBLOOM` (first order) · `DIAPER20` (diapering, once per customer) · `NEWMOM200` (mom care)
- **Payments:** leave the keys blank to use the demo gateway. Add Razorpay or Stripe **test** keys for real checkout (Stripe test card `4242 4242 4242 4242`).
- **Tests:** `cd backend && npm test` runs 24 unit tests without a database. They cover:
  - Coupon rules, GST split, place of supply and amount in words
  - Financial-year numbering, refund maths and courier links
  - Pincode zones and ETAs, and the injection guard
  - Pricing, using in-memory fakes in place of the database
  - Live-event routing, email escaping, WhatsApp text and the label barcode

| `.env` | Purpose |
|---|---|
| `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL` | Required |
| `RAZORPAY_KEY` (or `RAZORPAY_KEY_ID`), `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Razorpay payments, webhook and refunds |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe payments, webhook and refunds |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Product and banner image uploads |
| `SELLER_NAME`, `SELLER_ADDRESS`, `SELLER_GSTIN`, `SELLER_STATE` | Details printed on the GST invoice |
| `SMTP_*`, `MAIL_FROM` | Order emails with the invoice PDF attached (logged to the console if not set) |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TEMPLATE` | WhatsApp Business Cloud API |

**Webhooks:** point Razorpay at `/api/payments/razorpay/webhook` and Stripe at `/api/payments/stripe/webhook`.

### Ready to deploy on Vercel + Render / Railway
- **Frontend → Vercel:**
  - Root folder `frontend`, framework Vite.
  - Set `VITE_API_URL=https://<api>/api`.
  - `vercel.json` handles page routing.
- **Backend → Render:** `render.yaml` sets up the service and lists every environment variable.
- **Backend → Railway:** `backend/railway.json` contains the build, start and health-check settings.
- Set `CLIENT_URL` to the Vercel URL; it's used for CORS and the Stripe redirects.
- **CI:** GitHub Actions runs the backend tests and a production frontend build on every push.

---
Project 15 · BABY BLOOM · Complete Ready Product · MERN Stack · Premium Luxury UI
Built by **V. Hemanth Kumar** · [GitHub](https://github.com/hemanthkumar1012)
