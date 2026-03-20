import "./globals.css";

export const metadata = {
  title: "cityXai",
  description: "Souveräne kommunale KI"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
