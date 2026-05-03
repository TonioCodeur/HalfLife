"use client"

import * as React from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

/**
 * Toaster cyberpunk — branche directement sur notre attribut `data-theme`
 * (pas de dépendance à next-themes). Mise à jour via MutationObserver.
 */
function useDocumentTheme(): "light" | "dark" {
  const [theme, setTheme] = React.useState<"light" | "dark">("dark")
  React.useEffect(() => {
    const html = document.documentElement
    const read = () => {
      const t = html.getAttribute("data-theme")
      setTheme(t === "light" ? "light" : "dark")
    }
    read()
    const obs = new MutationObserver(read)
    obs.observe(html, { attributes: true, attributeFilter: ["data-theme"] })
    return () => obs.disconnect()
  }, [])
  return theme
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useDocumentTheme()

  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      duration={3200}
      visibleToasts={4}
      closeButton
      className="hl-toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "hl-toast",
          title: "hl-toast-title",
          description: "hl-toast-desc",
          actionButton: "hl-toast-action",
          cancelButton: "hl-toast-cancel",
          closeButton: "hl-toast-close",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
