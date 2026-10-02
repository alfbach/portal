"use client";

import { ToggleGroup, ToggleGroupItem } from "@patternfly/react-core";
import { MoonIcon, SunIcon } from "@patternfly/react-icons";
import { useTheme } from "./ThemeProvider";

export function ColorModeToggle() {
  const { mode, setMode } = useTheme();

  return (
    <ToggleGroup aria-label="Color mode">
      <ToggleGroupItem
        icon={<SunIcon />}
        text="Light"
        buttonId="color-mode-light"
        isSelected={mode === "light"}
        onChange={(_e, selected) => {
          if (selected) setMode("light");
        }}
      />
      <ToggleGroupItem
        icon={<MoonIcon />}
        text="Dark"
        buttonId="color-mode-dark"
        isSelected={mode === "dark"}
        onChange={(_e, selected) => {
          if (selected) setMode("dark");
        }}
      />
    </ToggleGroup>
  );
}
