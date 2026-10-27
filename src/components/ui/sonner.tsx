"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Bottom-centre toast, 2.6s by default (design/README.md). Undo toasts pass their own 5s. */
function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={(resolvedTheme as ToasterProps["theme"]) ?? "dark"}
      position="bottom-center"
      duration={2600}
      toastOptions={{
        style: {
          // Inverted, as in the design: text colour as background.
          background: "var(--text)",
          color: "var(--bg)",
          border: "0",
          boxShadow: "var(--shadow-lg)",
          borderRadius: "14px",
          padding: "12px 20px",
          fontFamily: "var(--font-poppins)",
          fontSize: "14px",
        },
        actionButtonStyle: { background: "var(--a)", color: "#fff", borderRadius: "8px", fontWeight: 500 },
      }}
      {...props}
    />
  );
}

export { Toaster };
