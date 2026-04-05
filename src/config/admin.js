export const ADMIN_EMAILS = [
  "rgoes@sef.sc.gov.br",
];

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || "").trim().toLowerCase());
}
