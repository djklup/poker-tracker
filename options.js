/**
 * Poker Tracker - Configurable Options
 * Edit stakes or game types here to update them throughout the entire application.
 */

window.POKER_CONFIG = {
  // Stakes available in dropdown menus
  stakes: [
    { value: "0.5/0.10", label: "$0.05 / $0.10" },
    { value: "0.10/0.20", label: "$0.10 / $.20" },
    { value: "0.25/0.50", label: "$0.25 / $0.50" },
    { value: "0.50/1.00", label: "$0.50 / $1.00" },
    { value: "1/2", label: "$1.00 / $2.00 ($200 NL)" },
    { value: "2.5/5", label: "$2.50 / $5.00 ($500/1000 NL)" },
  ],

  // Game types available in dropdown menus
  gameTypes: [
    { value: "NLH", label: "No Limit Hold'em (NLH)" },
    { value: "PLO4", label: "Pot Limit Omaha 4-Card (PLO4)" },
    { value: "Mixed", label: "Mixed Games" }
  ]
};
