import type { Client } from "./types";

// CSVの1フィールドをエスケープする（カンマ・改行・ダブルクォートを含む場合は引用符で囲む）
function esc(v: string): string {
  const s = v ?? "";
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(cells: string[]): string {
  return cells.map(esc).join(",");
}

/** 会社の基本情報・会社別ルール・商品情報を1つのCSV文字列にまとめる */
export function clientToCsv(c: Client): string {
  const lines: string[] = [];

  lines.push(row(["会社名", c.name]));
  if (c.kana) lines.push(row(["ふりがな", c.kana]));
  lines.push(row(["電話番号", c.phone]));
  lines.push(row(["FAX番号", c.fax]));
  lines.push(row(["担当者名", c.contact]));
  lines.push(row(["住所", c.address]));
  lines.push(row(["配送会社", c.carrier]));
  lines.push(row(["直送先", c.directShip]));
  lines.push(row(["その他", c.note]));
  lines.push(row(["取引状態", c.status === "active" ? "取引中" : "取引停止"]));

  lines.push("");
  lines.push(row(["会社別ルール"]));
  lines.push(row(["カテゴリ", "重要", "内容"]));
  if (c.rules.length === 0) {
    lines.push(row(["（登録なし）", "", ""]));
  } else {
    for (const r of c.rules) {
      lines.push(row([r.category, r.important ? "重要" : "", r.text]));
    }
  }

  lines.push("");
  lines.push(row(["商品情報"]));
  lines.push(row(["商品名", "取引先での呼び方", "重量", "規格"]));
  if (c.products.length === 0) {
    lines.push(row(["（登録なし）", "", "", ""]));
  } else {
    for (const p of c.products) {
      lines.push(row([p.name, p.alias, p.weight, p.spec]));
    }
  }

  return lines.join("\r\n");
}

/** CSVをファイルとしてダウンロードする（Excelで文字化けしないようUTF-8 BOM付き） */
export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
