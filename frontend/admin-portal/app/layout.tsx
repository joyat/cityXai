import "./globals.css";
import { I18nProvider } from "../lib/i18n";

export const metadata = {
  title: "cityXai",
  description: "Souveräne kommunale KI"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body><I18nProvider>{children}</I18nProvider></body>
    </html>
  );
}
