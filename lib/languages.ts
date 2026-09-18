export const TARGET_LANGUAGES = [
  { label: "English", value: "en" },
  { label: "Português", value: "pt" },
  { label: "Español", value: "es" },
  { label: "Français", value: "fr" },
  { label: "Deutsch", value: "de" },
] as const;

export type TargetLanguage = (typeof TARGET_LANGUAGES)[number]["value"];

export function isTargetLanguage(value: unknown): value is TargetLanguage {
  return (
    typeof value === "string" &&
    TARGET_LANGUAGES.some((language) => language.value === value)
  );
}

export function getTargetLanguageLabel(language: TargetLanguage) {
  return (
    TARGET_LANGUAGES.find((target) => target.value === language)?.label ??
    language
  );
}
