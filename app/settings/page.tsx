// =============================================================================
// app/settings/page.tsx
// 設定画面
//
// セクション構成:
//   👤 プロフィール    : 名前・自分の誕生日・自宅場所
//   🎂 誕生日・記念日  : 家族/友人の誕生日・結婚記念日・その他
//   🌤️ 天気設定        : 表示都市
//   🗺️ 地図設定        : 自宅座標
//   💰 支出設定        : 月予算・通貨
//   🔔 通知設定        : 記念日通知タイミング（将来）
//   🎨 表示設定        : カレンダーデフォルトモード（将来）
//
// 設計方針:
//   - 全データは localStorage に保存（将来Supabase差し替えポイント明記）
//   - セクションは SECTIONS 配列で管理（追加しやすい構造）
//   - 誕生日・記念日は常設機能として管理
// =============================================================================

"use client";
import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";

// -----------------------------------------------------------------------------
// 型定義
// -----------------------------------------------------------------------------

export type AnniversaryEntry = {
  id:     string;
  label:  string;
  type:   "birthday_self" | "birthday_family" | "birthday_friend" | "wedding" | "anniversary" | "other";
  month:  number;
  day:    number;
  year?:  number;  // 生まれ年 or 記念日の年
};

type ProfileSettings = {
  name:          string;
  birthdayMonth: number | "";
  birthdayDay:   number | "";
  birthdayYear:  number | "";
  homeCity:      string;
  homeLat:       number | "";
  homeLon:       number | "";
};

type WeatherSettings = {
  city: string;
};

type MapSettings = {
  homeLat: number | "";
  homeLon: number | "";
};

type BudgetSettings = {
  monthlyBudget: number | "";
  currency:      string;
};

type NotificationSettings = {
  anniversaryNoticeDays: number;  // 何日前から通知するか
};

type DisplaySettings = {
  calendarDefaultMode: "A" | "B" | "C";
  darkMode:            boolean;  // 将来用
};

// -----------------------------------------------------------------------------
// 定数
// -----------------------------------------------------------------------------

const STORAGE_KEYS = {
  profile:      "chamaProfile",
  anniversaries:"chamaAnniversaries",
  weather:      "chamaWeatherSettings",
  map:          "chamaMapSettings",
  budget:       "chamaBudgetSettings",
  notification: "chamaNotificationSettings",
  display:      "chamaDisplaySettings",
};

const ANNIVERSARY_TYPE_OPTIONS: { value: AnniversaryEntry["type"]; label: string; icon: string }[] = [
  { value: "birthday_self",   label: "自分の誕生日",   icon: "🎂" },
  { value: "birthday_family", label: "家族の誕生日",   icon: "👨‍👩‍👧" },
  { value: "birthday_friend", label: "友人の誕生日",   icon: "🎉" },
  { value: "wedding",         label: "結婚記念日",     icon: "💍" },
  { value: "anniversary",     label: "付き合い記念日", icon: "💑" },
  { value: "other",           label: "その他記念日",   icon: "🌟" },
];

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS   = Array.from({ length: 31 }, (_, i) => i + 1);

// -----------------------------------------------------------------------------
// ユーティリティ
// -----------------------------------------------------------------------------

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getAnniversaryIcon(type: AnniversaryEntry["type"]): string {
  return ANNIVERSARY_TYPE_OPTIONS.find(o => o.value === type)?.icon ?? "🌟";
}

// -----------------------------------------------------------------------------
// スタイル定数
// -----------------------------------------------------------------------------

const card: React.CSSProperties = {
  background: "white", borderRadius: "14px", padding: "16px",
  marginBottom: "12px", boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "15px", fontWeight: "bold", color: "#333",
  marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px",
};

const label: React.CSSProperties = {
  fontSize: "12px", color: "#666", marginBottom: "4px",
};

const input: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: "10px",
  border: "1px solid #ddd", fontSize: "14px", background: "white",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  padding: "8px 10px", borderRadius: "10px",
  border: "1px solid #ddd", fontSize: "14px", background: "white",
};

const saveBtn: React.CSSProperties = {
  width: "100%", padding: "10px", background: "#ff4d6d", color: "white",
  border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "bold",
  cursor: "pointer", touchAction: "manipulation", marginTop: "10px",
};

// -----------------------------------------------------------------------------
// プロフィールセクション
// -----------------------------------------------------------------------------
function ProfileSection() {
  const [profile, setProfile] = useState<ProfileSettings>({
    name: "", birthdayMonth: "", birthdayDay: "", birthdayYear: "",
    homeCity: "", homeLat: "", homeLon: "",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.profile) || "null");
    if (stored) setProfile(stored);
  }, []);

  function save() {
    // 将来: Supabase差し替えポイント
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={card}>
      <div style={sectionTitle}>👤 プロフィール</div>

      <div style={{ marginBottom: "10px" }}>
        <div style={label}>名前</div>
        <input style={input} value={profile.name}
          onChange={e => setProfile({ ...profile, name: e.target.value })}
          placeholder="例: チャマ" />
      </div>

      <div style={{ marginBottom: "10px" }}>
        <div style={label}>自分の誕生日</div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <input style={{ ...input, width: "80px" }} type="number"
            value={profile.birthdayYear}
            onChange={e => setProfile({ ...profile, birthdayYear: e.target.value === "" ? "" : Number(e.target.value) })}
            placeholder="年" inputMode="numeric" />
          <span style={{ color: "#999" }}>年</span>
          <select style={selectStyle} value={profile.birthdayMonth}
            onChange={e => setProfile({ ...profile, birthdayMonth: e.target.value === "" ? "" : Number(e.target.value) })}>
            <option value="">月</option>
            {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
          </select>
          <select style={selectStyle} value={profile.birthdayDay}
            onChange={e => setProfile({ ...profile, birthdayDay: e.target.value === "" ? "" : Number(e.target.value) })}>
            <option value="">日</option>
            {DAYS.map(d => <option key={d} value={d}>{d}日</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: "10px" }}>
        <div style={label}>自宅の都市名（天気表示用）</div>
        <input style={input} value={profile.homeCity}
          onChange={e => setProfile({ ...profile, homeCity: e.target.value })}
          placeholder="例: Osaka" />
      </div>

      <button onClick={save} style={saveBtn}>
        {saved ? "✅ 保存しました！" : "保存する"}
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 誕生日・記念日セクション
// -----------------------------------------------------------------------------
function AnniversarySection() {
  const [entries,    setEntries]    = useState<AnniversaryEntry[]>([]);
  const [showForm,   setShowForm]   = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [form, setForm] = useState<Omit<AnniversaryEntry, "id">>({
    label: "", type: "birthday_family", month: 1, day: 1, year: undefined,
  });

  useEffect(() => {
    // 将来: Supabase差し替えポイント
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.anniversaries) || "[]");
    setEntries(stored);
  }, []);

  function saveEntries(updated: AnniversaryEntry[]) {
    setEntries(updated);
    localStorage.setItem(STORAGE_KEYS.anniversaries, JSON.stringify(updated));
  }

  function handleSave() {
    if (!form.label) { alert("名称を入力してください"); return; }
    if (editingId) {
      saveEntries(entries.map(e => e.id === editingId ? { ...form, id: editingId } : e));
      setEditingId(null);
    } else {
      saveEntries([...entries, { ...form, id: createId() }]);
    }
    setForm({ label: "", type: "birthday_family", month: 1, day: 1, year: undefined });
    setShowForm(false);
  }

  function handleEdit(entry: AnniversaryEntry) {
    setForm({ label: entry.label, type: entry.type, month: entry.month, day: entry.day, year: entry.year });
    setEditingId(entry.id);
    setShowForm(true);
  }

  function handleDelete(id: string) {
    if (confirm("削除しますか？")) saveEntries(entries.filter(e => e.id !== id));
  }

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setForm({ label: "", type: "birthday_family", month: 1, day: 1, year: undefined });
  }

  const needsYear = ["birthday_self","birthday_family","birthday_friend","wedding","anniversary"].includes(form.type);

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <div style={sectionTitle}>🎂 誕生日・記念日</div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            style={{ padding: "5px 12px", fontSize: "13px", borderRadius: "8px",
              border: "none", background: "#ff4d6d", color: "white",
              cursor: "pointer", touchAction: "manipulation" }}>
            ＋ 追加
          </button>
        )}
      </div>

      {/* 追加・編集フォーム */}
      {showForm && (
        <div style={{ background: "#fff8f9", borderRadius: "10px", padding: "12px", marginBottom: "12px",
          border: "1px solid #ffcdd2" }}>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#ff4d6d", marginBottom: "10px" }}>
            {editingId ? "✏️ 編集" : "➕ 新規追加"}
          </div>

          <div style={{ marginBottom: "8px" }}>
            <div style={label}>種類</div>
            <select style={{ ...selectStyle, width: "100%" }} value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value as AnniversaryEntry["type"] })}>
              {ANNIVERSARY_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.icon} {o.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "8px" }}>
            <div style={label}>名称</div>
            <input style={input} value={form.label}
              onChange={e => setForm({ ...form, label: e.target.value })}
              placeholder="例: キーちゃんの誕生日" />
          </div>

          <div style={{ marginBottom: "8px" }}>
            <div style={label}>日付</div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
              {needsYear && (
                <>
                  <input style={{ ...input, width: "80px" }} type="number"
                    value={form.year ?? ""}
                    onChange={e => setForm({ ...form, year: e.target.value === "" ? undefined : Number(e.target.value) })}
                    placeholder="年" inputMode="numeric" />
                  <span style={{ color: "#999", fontSize: "13px" }}>年</span>
                </>
              )}
              <select style={selectStyle} value={form.month}
                onChange={e => setForm({ ...form, month: Number(e.target.value) })}>
                {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
              </select>
              <select style={selectStyle} value={form.day}
                onChange={e => setForm({ ...form, day: Number(e.target.value) })}>
                {DAYS.map(d => <option key={d} value={d}>{d}日</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
            <button onClick={handleSave}
              style={{ flex: 1, padding: "8px", background: "#ff4d6d", color: "white",
                border: "none", borderRadius: "8px", fontSize: "14px",
                cursor: "pointer", touchAction: "manipulation" }}>
              {editingId ? "更新する" : "追加する"}
            </button>
            <button onClick={handleCancel}
              style={{ flex: 1, padding: "8px", background: "#f0f0f0",
                border: "none", borderRadius: "8px", fontSize: "14px",
                cursor: "pointer", touchAction: "manipulation" }}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* 登録済み一覧 */}
      {entries.length === 0 ? (
        <div style={{ fontSize: "13px", color: "#aaa", textAlign: "center", padding: "16px 0" }}>
          まだ登録されていません
        </div>
      ) : (
        entries.map(entry => (
          <div key={entry.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 0", borderBottom: "1px solid #f5f5f5",
          }}>
            <div>
              <span style={{ marginRight: "6px" }}>{getAnniversaryIcon(entry.type)}</span>
              <span style={{ fontSize: "14px", fontWeight: "bold" }}>{entry.label}</span>
              <div style={{ fontSize: "12px", color: "#999", marginTop: "2px", paddingLeft: "22px" }}>
                {entry.year ? `${entry.year}年` : ""}{entry.month}月{entry.day}日
              </div>
            </div>
            <div style={{ display: "flex", gap: "4px" }}>
              <button onClick={() => handleEdit(entry)}
                style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
                  border: "1px solid #ddd", background: "#f5f5f5",
                  cursor: "pointer", touchAction: "manipulation" }}>修正</button>
              <button onClick={() => handleDelete(entry.id)}
                style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
                  border: "1px solid #ffcdd2", background: "#fff0f0", color: "#e53935",
                  cursor: "pointer", touchAction: "manipulation" }}>削除</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 天気設定セクション
// -----------------------------------------------------------------------------
function WeatherSection() {
  const [settings, setSettings] = useState<WeatherSettings>({ city: "Osaka" });
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.weather) || "null");
    if (stored) setSettings(stored);
  }, []);

  function save() {
    localStorage.setItem(STORAGE_KEYS.weather, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={card}>
      <div style={sectionTitle}>🌤️ 天気設定</div>
      <div style={{ marginBottom: "10px" }}>
        <div style={label}>表示する都市（英語表記）</div>
        <input style={input} value={settings.city}
          onChange={e => setSettings({ ...settings, city: e.target.value })}
          placeholder="例: Osaka / Tokyo / Sapporo" />
        <div style={{ fontSize: "11px", color: "#aaa", marginTop: "4px" }}>
          ※ OpenWeatherMapで認識できる都市名を入力してください
        </div>
      </div>
      <button onClick={save} style={saveBtn}>
        {saved ? "✅ 保存しました！" : "保存する"}
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 地図設定セクション
// -----------------------------------------------------------------------------
function MapSection() {
  const [settings, setSettings] = useState<MapSettings>({ homeLat: "", homeLon: "" });
  const [saved,    setSaved]    = useState(false);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.map) || "null");
    if (stored) setSettings(stored);
  }, []);

  function save() {
    localStorage.setItem(STORAGE_KEYS.map, JSON.stringify(settings));
    // useMapData.tsのHOME_LAT/HOME_LONも更新
    localStorage.setItem("chamaHomeLat", String(settings.homeLat));
    localStorage.setItem("chamaHomeLon", String(settings.homeLon));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function getCurrentLocation() {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setSettings({ homeLat: pos.coords.latitude, homeLon: pos.coords.longitude });
        setLoading(false);
      },
      () => { alert("位置情報の取得に失敗しました"); setLoading(false); }
    );
  }

  return (
    <div style={card}>
      <div style={sectionTitle}>🗺️ 地図設定</div>
      <div style={{ marginBottom: "10px" }}>
        <div style={label}>自宅の緯度・経度（地図の起点）</div>
        <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ ...label, marginBottom: "2px" }}>緯度</div>
            <input style={input} type="number" value={settings.homeLat}
              onChange={e => setSettings({ ...settings, homeLat: e.target.value === "" ? "" : Number(e.target.value) })}
              placeholder="例: 34.58371" inputMode="decimal" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ ...label, marginBottom: "2px" }}>経度</div>
            <input style={input} type="number" value={settings.homeLon}
              onChange={e => setSettings({ ...settings, homeLon: e.target.value === "" ? "" : Number(e.target.value) })}
              placeholder="例: 135.52496" inputMode="decimal" />
          </div>
        </div>
        <button onClick={getCurrentLocation} disabled={loading}
          style={{ width: "100%", padding: "8px", background: "#f0f0f0",
            border: "1px solid #ddd", borderRadius: "10px", fontSize: "13px",
            cursor: "pointer", touchAction: "manipulation" }}>
          {loading ? "取得中..." : "📍 現在地を自宅に設定する"}
        </button>
      </div>
      <button onClick={save} style={saveBtn}>
        {saved ? "✅ 保存しました！" : "保存する"}
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 支出設定セクション
// -----------------------------------------------------------------------------
function BudgetSection() {
  const [settings, setSettings] = useState<BudgetSettings>({ monthlyBudget: "", currency: "JPY" });
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.budget) || "null");
    if (stored) setSettings(stored);
  }, []);

  function save() {
    localStorage.setItem(STORAGE_KEYS.budget, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={card}>
      <div style={sectionTitle}>💰 支出設定</div>
      <div style={{ marginBottom: "10px" }}>
        <div style={label}>月の予算</div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <input style={{ ...input, flex: 1 }} type="number" value={settings.monthlyBudget}
            onChange={e => setSettings({ ...settings, monthlyBudget: e.target.value === "" ? "" : Number(e.target.value) })}
            placeholder="例: 100000" inputMode="numeric" />
          <span style={{ fontSize: "14px", color: "#666" }}>円</span>
        </div>
        <div style={{ fontSize: "11px", color: "#aaa", marginTop: "4px" }}>
          ※ 将来の分析画面で予算達成度を表示します
        </div>
      </div>
      <div style={{ marginBottom: "10px" }}>
        <div style={label}>通貨</div>
        <select style={{ ...selectStyle, width: "100%" }} value={settings.currency}
          onChange={e => setSettings({ ...settings, currency: e.target.value })}>
          <option value="JPY">🇯🇵 日本円 (JPY)</option>
          <option value="USD">🇺🇸 米ドル (USD)</option>
          <option value="EUR">🇪🇺 ユーロ (EUR)</option>
          <option value="GBP">🇬🇧 英ポンド (GBP)</option>
          <option value="KRW">🇰🇷 韓国ウォン (KRW)</option>
          <option value="CNY">🇨🇳 中国元 (CNY)</option>
          <option value="THB">🇹🇭 タイバーツ (THB)</option>
        </select>
        <div style={{ fontSize: "11px", color: "#aaa", marginTop: "4px" }}>
          ※ 将来の海外対応時に使用します
        </div>
      </div>
      <button onClick={save} style={saveBtn}>
        {saved ? "✅ 保存しました！" : "保存する"}
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 通知設定セクション（将来拡張用）
// -----------------------------------------------------------------------------
function NotificationSection() {
  const [settings, setSettings] = useState<NotificationSettings>({ anniversaryNoticeDays: 7 });
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.notification) || "null");
    if (stored) setSettings(stored);
  }, []);

  function save() {
    localStorage.setItem(STORAGE_KEYS.notification, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={card}>
      <div style={sectionTitle}>🔔 通知設定</div>
      <div style={{ marginBottom: "10px" }}>
        <div style={label}>誕生日・記念日の事前通知</div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <select style={selectStyle} value={settings.anniversaryNoticeDays}
            onChange={e => setSettings({ ...settings, anniversaryNoticeDays: Number(e.target.value) })}>
            {[1, 3, 5, 7, 14, 30].map(d => (
              <option key={d} value={d}>{d}日前から表示</option>
            ))}
          </select>
        </div>
      </div>
      <button onClick={save} style={saveBtn}>
        {saved ? "✅ 保存しました！" : "保存する"}
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 表示設定セクション（将来拡張用）
// -----------------------------------------------------------------------------
function DisplaySection() {
  const [settings, setSettings] = useState<DisplaySettings>({
    calendarDefaultMode: "C", darkMode: false,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.display) || "null");
    if (stored) setSettings(stored);
  }, []);

  function save() {
    localStorage.setItem(STORAGE_KEYS.display, JSON.stringify(settings));
    // カレンダーモードも更新
    localStorage.setItem("chamaCalendarMode", settings.calendarDefaultMode);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={card}>
      <div style={sectionTitle}>🎨 表示設定</div>
      <div style={{ marginBottom: "10px" }}>
        <div style={label}>カレンダーのデフォルト表示</div>
        <div style={{ display: "flex", gap: "6px" }}>
          {([
            { key: "A", label: "A: シンプル" },
            { key: "B", label: "B: イベントバー" },
            { key: "C", label: "C: アジェンダ" },
          ] as { key: "A"|"B"|"C"; label: string }[]).map(({ key, label: l }) => (
            <button key={key} onClick={() => setSettings({ ...settings, calendarDefaultMode: key })}
              style={{ flex: 1, padding: "6px", fontSize: "12px", borderRadius: "8px",
                border: "none", cursor: "pointer", touchAction: "manipulation",
                background: settings.calendarDefaultMode === key ? "#ff4d6d" : "#f0f0f0",
                color: settings.calendarDefaultMode === key ? "white" : "#555" }}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: "10px" }}>
        <div style={label}>ダークモード（将来対応）</div>
        <div style={{ fontSize: "13px", color: "#aaa", padding: "8px",
          background: "#f9f9f9", borderRadius: "8px" }}>
          🚧 現在準備中です
        </div>
      </div>
      <button onClick={save} style={saveBtn}>
        {saved ? "✅ 保存しました！" : "保存する"}
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// メインページ
// -----------------------------------------------------------------------------

// セクション一覧（将来追加する時はここに追加するだけ）
const SECTIONS = [
  { id: "profile",      label: "👤 プロフィール",    component: <ProfileSection /> },
  { id: "anniversary",  label: "🎂 誕生日・記念日",  component: <AnniversarySection /> },
  { id: "weather",      label: "🌤️ 天気設定",        component: <WeatherSection /> },
  { id: "map",          label: "🗺️ 地図設定",         component: <MapSection /> },
  { id: "budget",       label: "💰 支出設定",         component: <BudgetSection /> },
  { id: "notification", label: "🔔 通知設定",         component: <NotificationSection /> },
  { id: "display",      label: "🎨 表示設定",         component: <DisplaySection /> },
];

export default function SettingsPage() {
  const [openSection, setOpenSection] = useState<string | null>("profile");

  return (
    <div style={{ maxWidth: "420px", margin: "auto", fontFamily: "sans-serif",
      background: "#f4f6f8", minHeight: "100vh", paddingBottom: "80px" }}>

      {/* ヘッダー */}
      <div style={{ padding: "16px 20px 12px", background: "white",
        boxShadow: "0 2px 4px rgba(0,0,0,0.06)", marginBottom: "12px" }}>
        <h1 style={{ margin: 0, fontSize: "20px" }}>⚙️ 設定</h1>
      </div>

      <div style={{ padding: "0 16px" }}>
        {SECTIONS.map(section => (
          <div key={section.id} style={{ marginBottom: "8px" }}>
            {/* セクションヘッダー（アコーディオン） */}
            <button
              onClick={() => setOpenSection(openSection === section.id ? null : section.id)}
              style={{ width: "100%", padding: "14px 16px", background: "white",
                border: "none", borderRadius: openSection === section.id ? "14px 14px 0 0" : "14px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.06)", cursor: "pointer",
                touchAction: "manipulation", display: "flex",
                justifyContent: "space-between", alignItems: "center" }}
            >
              <span style={{ fontSize: "15px", fontWeight: "bold", color: "#333" }}>
                {section.label}
              </span>
              <span style={{ fontSize: "14px", color: "#aaa",
                transform: openSection === section.id ? "rotate(180deg)" : "none",
                transition: "transform 0.2s" }}>▼</span>
            </button>

            {/* セクションコンテンツ */}
            {openSection === section.id && (
              <div style={{ background: "white", borderRadius: "0 0 14px 14px",
                padding: "0 16px 16px", boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                borderTop: "1px solid #f0f0f0" }}>
                <div style={{ paddingTop: "14px" }}>
                  {section.component}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <NavBar />
    </div>
  );
}
