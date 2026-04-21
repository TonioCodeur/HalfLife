import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Cyberpunk neon buttons.
 * Each néon variant combine : fond saturé, texte sombre lisible (ou texte néon
 * sur outline), bordure assortie, et glow via box-shadow.
 * Au survol l'intensité du glow augmente, au focus un anneau s'ajoute.
 */
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-md border text-sm font-bold uppercase tracking-wider whitespace-nowrap transition-all outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/60 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Rose néon — fond rose hot, texte sombre, glow rose intense
        default:
          "border-[var(--neon-pink)] bg-[var(--neon-pink)] text-[oklch(0.10_0.04_295)] shadow-[0_0_10px_var(--neon-pink),0_0_24px_color-mix(in_oklch,var(--neon-pink),transparent_55%),inset_0_0_8px_color-mix(in_oklch,white,transparent_70%)] hover:shadow-[0_0_14px_var(--neon-pink),0_0_36px_color-mix(in_oklch,var(--neon-pink),transparent_40%),inset_0_0_10px_color-mix(in_oklch,white,transparent_60%)] hover:brightness-110",

        // Blanc néon — fond blanc, texte rose néon glowy, halo blanc/rose
        white:
          "border-white bg-white text-[var(--neon-pink)] [text-shadow:0_0_8px_color-mix(in_oklch,var(--neon-pink),transparent_30%)] shadow-[0_0_10px_white,0_0_22px_color-mix(in_oklch,white,transparent_55%),0_0_36px_color-mix(in_oklch,var(--neon-pink),transparent_60%)] hover:shadow-[0_0_14px_white,0_0_30px_color-mix(in_oklch,white,transparent_40%),0_0_50px_color-mix(in_oklch,var(--neon-pink),transparent_45%)] hover:brightness-110",

        // Cyan néon
        cyan:
          "border-[var(--neon-cyan)] bg-[var(--neon-cyan)] text-[oklch(0.10_0.04_295)] shadow-[0_0_10px_var(--neon-cyan),0_0_24px_color-mix(in_oklch,var(--neon-cyan),transparent_55%),inset_0_0_8px_color-mix(in_oklch,white,transparent_70%)] hover:shadow-[0_0_14px_var(--neon-cyan),0_0_36px_color-mix(in_oklch,var(--neon-cyan),transparent_40%)] hover:brightness-110",

        // Vert lime néon
        lime:
          "border-[var(--neon-lime)] bg-[var(--neon-lime)] text-[oklch(0.10_0.04_295)] shadow-[0_0_10px_var(--neon-lime),0_0_24px_color-mix(in_oklch,var(--neon-lime),transparent_55%),inset_0_0_8px_color-mix(in_oklch,white,transparent_70%)] hover:shadow-[0_0_14px_var(--neon-lime),0_0_36px_color-mix(in_oklch,var(--neon-lime),transparent_40%)] hover:brightness-110",

        // Violet néon
        purple:
          "border-[var(--neon-purple)] bg-[var(--neon-purple)] text-white shadow-[0_0_10px_var(--neon-purple),0_0_24px_color-mix(in_oklch,var(--neon-purple),transparent_50%),inset_0_0_8px_color-mix(in_oklch,white,transparent_75%)] hover:shadow-[0_0_14px_var(--neon-purple),0_0_36px_color-mix(in_oklch,var(--neon-purple),transparent_35%)] hover:brightness-110",

        // Jaune néon
        yellow:
          "border-[var(--neon-yellow)] bg-[var(--neon-yellow)] text-[oklch(0.10_0.04_295)] shadow-[0_0_10px_var(--neon-yellow),0_0_24px_color-mix(in_oklch,var(--neon-yellow),transparent_55%),inset_0_0_8px_color-mix(in_oklch,white,transparent_70%)] hover:shadow-[0_0_14px_var(--neon-yellow),0_0_36px_color-mix(in_oklch,var(--neon-yellow),transparent_40%)] hover:brightness-110",

        // Outline néon rose — fond transparent, bordure + texte rose lumineux
        outline:
          "border-[var(--neon-pink)] bg-transparent text-[var(--neon-pink)] [text-shadow:0_0_8px_color-mix(in_oklch,var(--neon-pink),transparent_30%)] shadow-[0_0_8px_color-mix(in_oklch,var(--neon-pink),transparent_50%),inset_0_0_8px_color-mix(in_oklch,var(--neon-pink),transparent_75%)] hover:bg-[color-mix(in_oklch,var(--neon-pink),transparent_85%)] hover:shadow-[0_0_14px_var(--neon-pink),inset_0_0_12px_color-mix(in_oklch,var(--neon-pink),transparent_65%)]",

        // Outline néon cyan
        "outline-cyan":
          "border-[var(--neon-cyan)] bg-transparent text-[var(--neon-cyan)] [text-shadow:0_0_8px_color-mix(in_oklch,var(--neon-cyan),transparent_30%)] shadow-[0_0_8px_color-mix(in_oklch,var(--neon-cyan),transparent_50%),inset_0_0_8px_color-mix(in_oklch,var(--neon-cyan),transparent_75%)] hover:bg-[color-mix(in_oklch,var(--neon-cyan),transparent_85%)] hover:shadow-[0_0_14px_var(--neon-cyan),inset_0_0_12px_color-mix(in_oklch,var(--neon-cyan),transparent_65%)]",

        // Glitch / ghost — discret, sur-souligné au focus
        ghost:
          "border-transparent bg-transparent text-foreground hover:bg-[color-mix(in_oklch,var(--neon-pink),transparent_88%)] hover:text-[var(--neon-pink)] hover:[text-shadow:0_0_8px_color-mix(in_oklch,var(--neon-pink),transparent_30%)]",

        // Lien glowing rose
        link:
          "border-transparent bg-transparent text-[var(--neon-pink)] [text-shadow:0_0_6px_color-mix(in_oklch,var(--neon-pink),transparent_40%)] underline underline-offset-4 hover:[text-shadow:0_0_12px_var(--neon-pink)]",

        // Destructive néon rouge
        destructive:
          "border-[oklch(0.65_0.30_25)] bg-[oklch(0.65_0.30_25)] text-white shadow-[0_0_10px_oklch(0.65_0.30_25),0_0_24px_color-mix(in_oklch,oklch(0.65_0.30_25),transparent_55%)] hover:shadow-[0_0_14px_oklch(0.65_0.30_25),0_0_36px_color-mix(in_oklch,oklch(0.65_0.30_25),transparent_40%)] hover:brightness-110",

        // Secondary — sombre violet, accent froid
        secondary:
          "border-[color-mix(in_oklch,var(--neon-purple),transparent_40%)] bg-secondary text-secondary-foreground shadow-[0_0_8px_color-mix(in_oklch,var(--neon-purple),transparent_60%)] hover:shadow-[0_0_14px_color-mix(in_oklch,var(--neon-purple),transparent_40%)]",
      },
      size: {
        // Tailles agrandies, ≥ cible tactile WCAG
        default:
          "h-11 gap-2 px-5 text-sm",
        xs: "h-7 gap-1 rounded-sm px-2.5 text-[0.7rem]",
        sm: "h-9 gap-1.5 rounded-sm px-3.5 text-xs",
        lg: "h-12 gap-2 px-6 text-base",
        xl: "h-14 gap-2.5 px-8 text-lg",
        icon: "size-11 [&_svg:not([class*='size-'])]:size-5",
        "icon-xs": "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 rounded-sm [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-12 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
