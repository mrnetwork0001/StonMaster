<div align="center">
  <div style="font-size: 4rem; margin-bottom: 1rem;">⚡</div>
  <h1>StonMaster</h1>
  <p><strong>Your all-in-one TON DeFi command center. Sweep dust tokens, maximize staking yields, and share trading strategies.</strong></p>
</div>

<br />

## 🚀 Overview

StonMaster is a powerful, unified utility hub built on the TON Blockchain. It elegantly combines decentralized exchange routing, liquid staking, and social trading into a sleek, premium interface. 

Our goal is to fix the fragmented UX of DeFi on TON by bringing the most powerful protocols (STON.fi, Tonstakers) under one roof.

## ✨ Core Features

### 🧹 StonSweep (Wallet Scanner & Dust Sweeper)
A one-click solution to clean up wallet clutter.
- Scans your wallet for low-value "dust" tokens (Jettons).
- Automatically routes and swaps them into TON using the **Omniston API**.
- Batches multiple swaps to respect the TON wallet outgoing message limits.

### 💎 Yield Maximizer (Liquid Staking)
Earn yield on your idle TON without sacrificing liquidity.
- Direct integration with **Tonstakers** (`tonstakers-sdk` & Cache endpoints).
- Live, immediate TVL, APY, and price tracking synced with the official Tonstakers dashboard.
- Instant or standard unstake options.

### 🔗 SocialSwap (Shareable Strategies)
Make trading social on TON.
- Build a custom trade route (e.g., $100 TON → USDT).
- Generate a Supabase-backed short link mapped to your wallet referral ID.
- Share the link on Telegram or X. Anyone clicking it gets a live quote via Omniston and can execute the trade with a single click.

### 🔄 Advanced Swap
For power users who need the full STON.fi experience.
- Native integration of the `@ston-fi/omniston-widget-loader`.
- Direct access to deep liquidity and complex routing paths.

## 🛠 Tech Stack

- **Frontend Framework:** React 18, Vite, TypeScript
- **Styling:** Vanilla CSS (Glassmorphism & Neumorphism design system), Framer Motion
- **TON Web3:** `@tonconnect/ui-react`, `@ston-fi/omniston-sdk-react`, `tonstakers-sdk`
- **Data & APIs:** TonAPI (real-time balances & metadata), Tonstakers Cache API
- **Social Auth:** Privy (`@privy-io/react-auth`)
- **Database:** Supabase (for SocialSwap short links & referrer mappings)

## 💻 Running Locally

### Prerequisites
- Node.js (v18+)
- A [Supabase](https://supabase.com/) project
- A [TonAPI](https://tonconsole.com/) key
- A [Privy](https://privy.io/) App ID

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/your-username/stonmaster.git
   cd stonmaster
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   VITE_TONAPI_KEY=your_tonapi_key
   VITE_TONSTAKERS_PARTNER_CODE=0
   VITE_MANIFEST_URL=https://your-domain.com/tonconnect-manifest.json
   VITE_PRIVY_APP_ID=your_privy_app_id
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Supabase Schema (for SocialSwap)**
   Create a table named `short_links`:
   - `id` (text, primary key)
   - `from_token` (text)
   - `to_token` (text)
   - `amount` (text)
   - `referrer` (text)
   - `created_at` (timestampz)

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## 📜 License

MIT License
