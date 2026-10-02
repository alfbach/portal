import type { Metadata } from "next";
import "@patternfly/react-core/dist/styles/base.css";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "OPS Portal",
  description: "Configurable homelab portal with health checks and uplink telemetry",
};

const themeInitScript = `
(function(){
  try {
    var m = localStorage.getItem('pf-color-mode');
    if (m !== 'light' && m !== 'dark') {
      m = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (m === 'dark') document.documentElement.classList.add('pf-v6-theme-dark');
    document.documentElement.style.colorScheme = m;
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
