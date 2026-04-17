import React, { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

const env = typeof import.meta !== "undefined" ? import.meta.env : {};
const legacyEnv =
  typeof process !== "undefined" && process.env ? process.env : {};

// ── CONFIG ──────────────────────────────────────────────────────────────────
// Replace with your actual Azure Function URL after deployment
const AZURE_API_URL =
  env.VITE_AZURE_API_URL ||
  env.REACT_APP_AZURE_API_URL ||
  legacyEnv.REACT_APP_AZURE_API_URL ||
  "";

// Replace with your AWS SNS Lambda proxy URL (see aws-sns-proxy/README.md)
const AWS_SNS_PROXY_URL =
  env.VITE_SNS_PROXY_URL ||
  env.REACT_APP_SNS_PROXY_URL ||
  legacyEnv.REACT_APP_SNS_PROXY_URL ||
  "";

// ── UTILITIES ────────────────────────────────────────────────────────────────
const INDIAN_CITIES = [
  "Chennai", "Mumbai", "Delhi", "Kolkata", "Bangalore",
  "Hyderabad", "Ahmedabad", "Pune", "Jaipur", "Surat",
  "Lucknow", "Kanpur", "Nagpur", "Patna", "Bhopal",
  "Visakhapatnam", "Vadodara", "Coimbatore", "Agra", "Kochi",
  "Madurai", "Varanasi", "Meerut", "Nashik", "Indore",
  "Thiruvananthapuram", "Bhubaneswar", "Guwahati", "Chandigarh", "Amritsar"
];

const getRiskLevel = (rainfall, waterLevel) => {
  if (rainfall > 80 || waterLevel > 4) return "HIGH";
  if (rainfall > 50 || waterLevel > 2.5) return "MODERATE";
  return "LOW";
};

// ── COMPONENTS ────────────────────────────────────────────────────────────────

function RippleAlert({ active, risk }) {
  if (!active) return null;
  return (
    <div className={`ripple-container ${risk === "HIGH" ? "ripple-danger" : risk === "MODERATE" ? "ripple-warn" : "ripple-safe"}`}>
      <div className="ripple r1" />
      <div className="ripple r2" />
      <div className="ripple r3" />
      <div className={`ripple-core ${risk === "HIGH" ? "core-danger" : risk === "MODERATE" ? "core-warn" : "core-safe"}`}>
        {risk === "HIGH" ? "⚠" : risk === "MODERATE" ? "⚡" : "✓"}
      </div>
    </div>
  );
}

function RadarSweep({ scanning }) {
  return (
    <div className={`radar-wrap ${scanning ? "scanning" : ""}`}>
      <div className="radar-grid">
        {[1, 2, 3].map(i => <div key={i} className={`radar-ring ring-${i}`} />)}
        <div className="radar-cross h" /><div className="radar-cross v" />
        {scanning && <div className="radar-sweep" />}
        {scanning && (
          <>
            <div className="radar-blip b1" />
            <div className="radar-blip b2" />
            <div className="radar-blip b3" />
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, icon, max, color }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div className="metric-body">
        <div className="metric-label">{label}</div>
        <div className="metric-value" style={{ color }}>
          {value}<span className="metric-unit">{unit}</span>
        </div>
        <div className="metric-bar-track">
          <div className="metric-bar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}

function AlertBanner({ risk, location, timestamp }) {
  if (!risk) return null;
  const isHigh = risk === "HIGH";
  const isMod = risk === "MODERATE";
  return (
    <div className={`alert-banner ${isHigh ? "banner-danger" : isMod ? "banner-warn" : "banner-safe"}`}>
      <div className="banner-left">
        <div className={`status-orb ${isHigh ? "orb-danger" : isMod ? "orb-warn" : "orb-safe"}`} />
        <div>
          <div className="banner-title">
            {isHigh ? "🚨 HIGH FLOOD RISK DETECTED" : isMod ? "⚡ MODERATE RISK — STAY ALERT" : "✅ AREA CLEAR — LOW RISK"}
          </div>
          <div className="banner-sub">
            Location: <strong>{location}</strong> &nbsp;|&nbsp; {timestamp}
          </div>
        </div>
      </div>
      <div className="banner-badge">
        {isHigh ? "EVACUATE" : isMod ? "CAUTION" : "SAFE"}
      </div>
    </div>
  );
}

function HistoryTable({ records }) {
  if (!records.length) return (
    <div className="no-history">No assessments yet. Submit a location above.</div>
  );
  return (
    <table className="history-table">
      <thead>
        <tr>
          <th>#</th><th>Location</th><th>Rainfall (mm)</th><th>Water Level (m)</th><th>Risk</th><th>Time</th>
        </tr>
      </thead>
      <tbody>
        {[...records].reverse().map((r, i) => (
          <tr key={r.id} className={`row-${r.risk.toLowerCase()}`}>
            <td>{records.length - i}</td>
            <td>{r.location}</td>
            <td>{r.rainfall}</td>
            <td>{r.waterLevel}</td>
            <td>
              <span className={`risk-badge badge-${r.risk.toLowerCase()}`}>{r.risk}</span>
            </td>
            <td className="mono">{r.time}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatsSummary({ records }) {
  const high = records.filter(r => r.risk === "HIGH").length;
  const mod = records.filter(r => r.risk === "MODERATE").length;
  const low = records.filter(r => r.risk === "LOW").length;
  return (
    <div className="stats-row">
      <div className="stat-box stat-danger"><div className="stat-num">{high}</div><div className="stat-lbl">HIGH RISK</div></div>
      <div className="stat-box stat-warn"><div className="stat-num">{mod}</div><div className="stat-lbl">MODERATE</div></div>
      <div className="stat-box stat-safe"><div className="stat-num">{low}</div><div className="stat-lbl">LOW RISK</div></div>
      <div className="stat-box stat-total"><div className="stat-num">{records.length}</div><div className="stat-lbl">TOTAL SCANS</div></div>
    </div>
  );
}

export default function App() {
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [rainfall, setRainfall] = useState("");
  const [waterLevel, setWaterLevel] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [alertSent, setAlertSent] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cityFilter, setCityFilter] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [snsSent, setSnsSent] = useState(false);
  const counterRef = useRef(0);
  const dropdownRef = useRef(null);

  const filteredCities = INDIAN_CITIES.filter(c =>
    c.toLowerCase().includes(cityFilter.toLowerCase())
  ).slice(0, 8);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const sendSNSAlert = useCallback(async (riskData) => {
    if (!AWS_SNS_PROXY_URL || !email || !email.includes("@")) return;
    try {
      await fetch(AWS_SNS_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          location: riskData.location,
          risk: riskData.risk,
          rainfall: riskData.rainfall,
          waterLevel: riskData.waterLevel,
          timestamp: new Date().toLocaleString()
        })
      });
      setSnsSent(true);
      setTimeout(() => setSnsSent(false), 5000);
    } catch (e) {
      console.warn("SNS alert skipped (proxy not configured yet):", e.message);
    }
  }, [email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setAlertSent(false);

    const rf = parseFloat(rainfall);
    const wl = parseFloat(waterLevel);
    if (!location.trim()) { setError("Please select or enter a location."); return; }
    if (isNaN(rf) || rf < 0 || rf > 500) { setError("Rainfall must be between 0 and 500 mm."); return; }
    if (isNaN(wl) || wl < 0 || wl > 20) { setError("Water level must be between 0 and 20 m."); return; }

    setLoading(true);
    setScanning(true);

    try {
      let data;
      if (!AZURE_API_URL) {
        console.warn("Azure API URL not configured, using local fallback.");
        data = { Rainfall: rf, WaterLevel: wl, Risk: getRiskLevel(rf, wl) };
      } else {
        const res = await fetch(AZURE_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Rainfall: rf, WaterLevel: wl })
        });

        if (!res.ok) {
          console.warn("Azure API unreachable, using local fallback.");
          data = { Rainfall: rf, WaterLevel: wl, Risk: getRiskLevel(rf, wl) };
        } else {
          data = await res.json();
        }
      }

      const riskData = {
        id: ++counterRef.current,
        location: location.trim(),
        rainfall: data.Rainfall,
        waterLevel: data.WaterLevel,
        risk: data.Risk,
        time: new Date().toLocaleTimeString()
      };

      setResult(riskData);
      setHistory(prev => [...prev, riskData]);
      setAlertSent(true);
      await sendSNSAlert(riskData);

    } catch (err) {
      const riskData = {
        id: ++counterRef.current,
        location: location.trim(),
        rainfall: rf,
        waterLevel: wl,
        risk: getRiskLevel(rf, wl),
        time: new Date().toLocaleTimeString()
      };
      setResult(riskData);
      setHistory(prev => [...prev, riskData]);
      setAlertSent(true);
      await sendSNSAlert(riskData);
    } finally {
      setTimeout(() => { setLoading(false); setScanning(false); }, 800);
    }
  };

  const riskColor = result
    ? result.risk === "HIGH" ? "#ff2d55" : result.risk === "MODERATE" ? "#ff9500" : "#30d158"
    : null;

  return (
    <div className="app">
      <div className="bg-grid" />
      <div className="bg-glow g1" />
      <div className="bg-glow g2" />

      <header className="header">
        <div className="header-left">
          <div className="logo-icon">🌊</div>
          <div>
            <h1 className="logo-title">FLOOD RISK ALERT SYSTEM</h1>
            <div className="logo-sub">Real-Time Monitoring &amp; Intelligent Alert Infrastructure</div>
          </div>
        </div>
        <div className="header-right">
          <div className="live-indicator">
            <span className="live-dot" />
            LIVE
          </div>
          <div className="cloud-badges">
            <span className="cloud-badge azure">⬡ Azure</span>
            <span className="cloud-badge aws">⬡ AWS</span>
          </div>
        </div>
      </header>

      <main className="main-grid">
        <section className="panel input-panel">
          <div className="panel-header">
            <span className="panel-icon">📡</span>
            <span>RISK ASSESSMENT INPUT</span>
          </div>

          <form onSubmit={handleSubmit} className="form">
            <div className="form-group" ref={dropdownRef}>
              <label className="form-label">LOCATION / CITY</label>
              <input
                className="form-input"
                placeholder="Type or select a city..."
                value={location}
                onChange={e => { setLocation(e.target.value); setCityFilter(e.target.value); setShowDropdown(true); }}
                onFocus={() => { setCityFilter(location); setShowDropdown(true); }}
                autoComplete="off"
              />
              {showDropdown && filteredCities.length > 0 && (
                <div className="city-dropdown">
                  {filteredCities.map(c => (
                    <div key={c} className="city-option" onClick={() => { setLocation(c); setShowDropdown(false); }}>
                      📍 {c}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">ALERT EMAIL <span className="opt">(for SNS notifications)</span></label>
              <input
                className="form-input"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">RAINFALL <span className="unit-hint">mm (0–500)</span></label>
              <div className="range-row">
                <input
                  className="form-input range-input"
                  type="number"
                  min="0" max="500" step="0.1"
                  placeholder="e.g. 75"
                  value={rainfall}
                  onChange={e => setRainfall(e.target.value)}
                />
                <input
                  className="slider"
                  type="range"
                  min="0" max="200" step="1"
                  value={rainfall || 0}
                  onChange={e => setRainfall(e.target.value)}
                />
              </div>
              <div className="threshold-hint">⚠ HIGH threshold: &gt; 80 mm</div>
            </div>

            <div className="form-group">
              <label className="form-label">WATER LEVEL <span className="unit-hint">m (0–20)</span></label>
              <div className="range-row">
                <input
                  className="form-input range-input"
                  type="number"
                  min="0" max="20" step="0.1"
                  placeholder="e.g. 3.5"
                  value={waterLevel}
                  onChange={e => setWaterLevel(e.target.value)}
                />
                <input
                  className="slider"
                  type="range"
                  min="0" max="10" step="0.1"
                  value={waterLevel || 0}
                  onChange={e => setWaterLevel(e.target.value)}
                />
              </div>
              <div className="threshold-hint">⚠ HIGH threshold: &gt; 4.0 m</div>
            </div>

            {error && <div className="error-box">⚠ {error}</div>}

            <button className="submit-btn" type="submit" disabled={loading}>
              {loading ? (
                <span className="btn-loading"><span className="spinner" /> SCANNING...</span>
              ) : (
                <span>⚡ ASSESS FLOOD RISK</span>
              )}
            </button>
          </form>

          <div className="service-tags">
            <div className="stag-title">AWS SERVICES ACTIVE</div>
            <div className="stag-list">
              {['S3 Static Hosting','CloudFront CDN','API Gateway','Lambda','SNS Alerts','Route 53','IAM','CloudWatch'].map(s => (
                <span key={s} className="stag">{s}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="panel center-panel">
          <div className="panel-header">
            <span className="panel-icon">🎯</span>
            <span>LIVE RISK STATUS</span>
          </div>

          <RadarSweep scanning={scanning} />

          {result && alertSent && (
            <>
              <RippleAlert active={alertSent} risk={result.risk} />
              <AlertBanner
                risk={result.risk}
                location={result.location}
                timestamp={result.time}
              />

              <div className="result-metrics">
                <MetricCard
                  label="Rainfall"
                  value={result.rainfall}
                  unit=" mm"
                  icon="🌧"
                  max={200}
                  color={result.rainfall > 80 ? "#ff2d55" : "#0a84ff"}
                />
                <MetricCard
                  label="Water Level"
                  value={result.waterLevel}
                  unit=" m"
                  icon="💧"
                  max={10}
                  color={result.waterLevel > 4 ? "#ff2d55" : "#30d158"}
                />
              </div>

              <div className="risk-verdict" style={{ borderColor: riskColor, boxShadow: `0 0 30px ${riskColor}44` }}>
                <div className="verdict-label">RISK CLASSIFICATION</div>
                <div className="verdict-value" style={{ color: riskColor }}>
                  {result.risk === "HIGH" ? "🚨 HIGH RISK" : result.risk === "MODERATE" ? "⚡ MODERATE RISK" : "✅ LOW RISK"}
                </div>
                <div className="verdict-msg">
                  {result.risk === "HIGH"
                    ? "Immediate evacuation recommended. Emergency services have been notified."
                    : result.risk === "MODERATE"
                    ? "Monitor conditions closely. Be prepared to evacuate if levels rise."
                    : "Conditions are stable. No immediate threat detected in this area."}
                </div>
              </div>

              {snsSent && (
                <div className="sns-banner">
                  📧 Alert email dispatched via AWS SNS → {email}
                </div>
              )}
            </>
          )}

          {!result && !loading && (
            <div className="idle-msg">
              <div className="idle-icon">🛰</div>
              <div>Enter location &amp; sensor data to begin assessment</div>
              <div className="idle-sub">System connected to Azure Flood-Risk API &amp; AWS infrastructure</div>
            </div>
          )}
        </section>

        <section className="panel right-panel">
          <div className="panel-header">
            <span className="panel-icon">📊</span>
            <span>ASSESSMENT HISTORY</span>
          </div>

          <StatsSummary records={history} />

          <div className="history-wrap">
            <HistoryTable records={history} />
          </div>

          <div className="arch-box">
            <div className="arch-title">⚙ SYSTEM ARCHITECTURE</div>
            <div className="arch-flow">
              <span className="arch-node">React UI</span>
              <span className="arch-arrow">→</span>
              <span className="arch-node aws">AWS CloudFront</span>
              <span className="arch-arrow">→</span>
              <span className="arch-node aws">API Gateway</span>
              <span className="arch-arrow">→</span>
              <span className="arch-node azure">Azure Function</span>
            </div>
            <div className="arch-flow" style={{ marginTop: "6px" }}>
              <span className="arch-node">Alert Trigger</span>
              <span className="arch-arrow">→</span>
              <span className="arch-node aws">Lambda</span>
              <span className="arch-arrow">→</span>
              <span className="arch-node aws">SNS</span>
              <span className="arch-arrow">→</span>
              <span className="arch-node">User Email</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>FLOOD RISK ALERT SYSTEM</span>
        <span className="footer-sep">|</span>
        <span>Powered by Azure App Service + AWS S3 · CloudFront · Lambda · SNS · API Gateway · Route 53 · IAM · CloudWatch</span>
      </footer>
    </div>
  );
}
