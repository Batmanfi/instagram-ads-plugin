import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";
export const fontsReady = (needsSerif = false, serifFont?: string | null) =>
  Promise.all(
    ["Roboto", "Roboto Condensed"].flatMap((family) =>
      [400, 500, 700].map((weight) =>
        loadFont({
          family,
          weight: String(weight),
          url: staticFile(
            `fonts/${family.replaceAll(" ", "")}-${weight === 400 ? "Regular" : weight === 500 ? "Medium" : "Bold"}.ttf`,
          ),
          format: "truetype",
        }),
      ),
    ),
  ).then(async () => {
    if (needsSerif) {
      // Load the exact locally installed family. A missing font fails visibly;
      // no fallback font is substituted and no OS font file is redistributed.
      if(!serifFont)throw Error('Times New Roman Regular requires an explicitly configured installed font file; no fallback');
      const face = new FontFace("Times New Roman", `url("${staticFile(serifFont)}")`, {weight: "400"});
      await face.load();
      (document.fonts as FontFaceSet & {add(face: FontFace): void}).add(face);
    }
    return document.fonts.ready;
  });
