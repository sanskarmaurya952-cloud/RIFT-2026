# SENTINEL Financial Forensics Engine

> A browser-based financial crime graph analysis system that detects money-muling networks through multi-pattern graph analysis and interactive visualisation.

---

## Live Demo url

> Deploy url our prioject:  https://incomparable-daffodil-bf2794.netlify.app

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5 / CSS3 / ES2020 JavaScript |
| Graph Viz | D3.js v7 (force-directed layout, SVG) |
| Fonts | Google Fonts — Rajdhani, Share Tech Mono, Exo 2 |
| Deployment | static host Netlify |

No build step. No bundler. No server required.

---

## Project Structure

```
rift-forensics/
├── index.html          ← Entry point & layout
├── css/
│   └── style.css       ← All styles (dark terminal aesthetic)
├── js/
│   ├── main.js         ← App bootstrap, pipeline orchestration, reset
│   ├── parser.js       ← CSV parsing (order-independent headers)
│   ├── graph.js        ← Directed graph builder (adjacency lists)
│   ├── detector.js     ← Fraud detection algorithms
│   ├── scorer.js       ← Suspicion scoring & RESULTS builder
│   ├── visualizer.js   ← D3 force graph, tooltip, filter, zoom
│   ├── ui.js           ← Right-panel tabs, stat cards, JSON download
│   └── demo.js         ← Synthetic dataset generator
└── README.md
```

---

## System Architecture

```
CSV Upload
    │
    ▼
parser.js ──────► G.txns[], G.nodes Map
    │
    ▼
graph.js ───────► G.adjOut, G.adjIn, G.edges
    │
    ├──► detector.js ─► detectCycles()       O(V·(V+E))
    │                ─► detectSmurfing()     O(V+E)
    │                ─► detectShellChains()  O(V+E)
    │
    ▼
scorer.js ──────► RESULTS { suspiciousAccounts, fraudRings, summary }
    │
    ├──► visualizer.js ─► D3 force graph (SVG)
    └──► ui.js         ─► Rings / Accounts / Table panels
```

---

## Algorithm Approach

### 1. Cycle Detection — O(V · (V + E))

Iterative DFS with an `inStack` map tracking node → path index.
When a back-edge is found, the cycle is extracted from the path slice.
Duplicate cycles are removed via **canonical rotation** (minimum-element first).
Overlapping cycles are merged into rings via a union-find-style pass.

Depth is capped at 5 to stay within the 3–5 hop specification and keep the
algorithm practical on 10K-transaction graphs.

### 2. Smurfing — O(V + E)

For every account:
- **Fan-in**: in-degree ≥ 10 distinct senders
- **Fan-out**: out-degree ≥ 10 distinct receivers
- **Temporal compression**: all transactions within 72 h → boosts score

**False-positive guards:**
- Merchant pattern: in-degree > 20, average amount < $500, out-degree < 3 → skipped
- Payroll pattern: in-degree ≤ 2, out-degree > 15, average outbound $1k–$15k → skipped

### 3. Shell Chain Detection — O(V + E)

Accounts with 2–3 total transactions are classified as "shells".
Greedy forward-tracing through consecutive shells produces chains.
Chains of ≥ 3 hops are flagged as layered shell networks.

---

## Suspicion Score Methodology

| Component | Value |
|---|---|
| Cycle base score | 75 + 3 × (number of overlapping cycles in ring) |
| Smurfing base | 70 (85 if temporally compressed) |
| Shell chain base | 72 + 4 × hop count |
| Volume bonus | min(15, totalVolume / 100 000 × 10) |
| Final cap | min(100, base + volume bonus) |

Scores are sorted descending in the output JSON.

---

## Input CSV Format

```
transaction_id,sender_id,receiver_id,amount,timestamp
TXN_00001,ACC_A001,ACC_A002,15000.00,2024-01-15 09:00:00
```

| Column | Type | Description |
|---|---|---|
| transaction_id | String | Unique identifier |
| sender_id | String | Source account |
| receiver_id | String | Destination account |
| amount | Float | Transaction amount |
| timestamp | DateTime | YYYY-MM-DD HH:MM:SS |

---

## Output JSON Format

```json
{
  "suspicious_accounts": [
    {
      "account_id": "ACC_A001",
      "suspicion_score": 87.5,
      "detected_patterns": ["cycle_length_3", "high_velocity"],
      "ring_id": "RING_001"
    }
  ],
  "fraud_rings": [
    {
      "ring_id": "RING_001",
      "member_accounts": ["ACC_A001", "ACC_A002", "ACC_A003"],
      "pattern_type": "cycle",
      "risk_score": 95.3
    }
  ],
  "summary": {
    "total_accounts_analyzed": 500,
    "suspicious_accounts_flagged": 15,
    "fraud_rings_detected": 4,
    "processing_time_seconds": 2.3
  }
}
```

---

## Installation & Usage

### Local

```bash
# Clone or download
cd rift-forensics
# Open in browser — no server needed for basic use
open index.html

# Or use a local server (avoids any CORS issues with future extensions)
npx serve .
python3 -m http.server 8080
```

### Deploy (Netlify)

1. Drag the `RIFT-2026/` folder onto Netlify Drop  
2. Share the generated URL — https://incomparable-daffodil-bf2794.netlify.app

---

## Known Limitations

- **Pure client-side**: all processing runs in the browser. Datasets > 50K transactions may slow the D3 simulation; consider WebWorker offloading for very large files.
- **Cycle detection depth**: capped at length 5 per spec. Longer laundering chains will not be detected.
- **No persistence**: results are lost on page refresh. Export JSON before closing.
- **Single-hop shell guard only**: shell detection looks 1 hop forward at a time; non-linear shell topologies (e.g., branching trees) may be partially missed.
- **Timestamp parsing**: relies on `new Date()` — non-standard date formats may parse as `NaN` and disable temporal analysis for those accounts.

---

## Team Members

*(LEADER : SANSKAR MAURYA)*
*(MEMBER : RAHUL KUMAR)*
*(MEMBER : SAKSHAM SAHU)*
*(MEMBER : RACHIT GUPTA)*