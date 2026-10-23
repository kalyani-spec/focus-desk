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
          background: "var(--card)",
          color: "var(--text)",
          border: "0",
          boxShadow: "var(--shadow-lg)",
          borderRadius: "12px",
          fontFamily: "var(--font-poppins)",
          fontSize: "13px",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
