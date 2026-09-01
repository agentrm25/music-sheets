# PDF Output Reference

This document defines Chart Creator's public PDF behavior. The implementation in `src-js/import-export.js` is authoritative when browser preview details differ.

## Output purpose

The PDF is a compact, stage-readable song chart rather than conventional sheet music. It uses:

- US Letter portrait pages;
- one centered reading column;
- Helvetica text;
- color cues for section types, chords, instructions, and verse numbers;
- bracketed arrangement notes;
- a small page count on every page;
- no editor controls, card backgrounds, workflow fields, or application-theme styling.

## Page geometry

| Property | Value |
| --- | --- |
| Page | US Letter portrait, 612 × 792 pt |
| Left and right margins | 40 pt |
| Content width | 532 pt |
| Top margin | 24 pt |
| Reserved footer area | 20 pt |
| Content break boundary | 748 pt from the top |
| Content alignment | Centered |
| Background | Plain white |

The footer is 9 pt gray Helvetica and displays `current / total`, such as `1 / 3`. It is positioned near the bottom-right corner. There is no running title, filename, date, or repeated section heading.

## Content order

When fields have values, PDF content appears in this order:

1. quoted song title;
2. artist;
3. BPM and time signature;
4. current key and original key;
5. capo;
6. arrangement notes;
7. sections and lines;
8. page count on every page.

Empty metadata fields are omitted without placeholders.

### Metadata formatting

- Title: `“Song Title”` using curly double quotation marks.
- Tempo: `126 BPM`.
- Tempo with meter: `126 BPM • 4/4`.
- Current key: `Key: D`.
- Current and original key: `Key: D (originally in E)`.
- Capo: `Capo - 2`.

## Base typography

PDF text uses jsPDF's built-in Helvetica family. No custom font file is embedded.

| Element | Base size | Style | Color |
| --- | ---: | --- | --- |
| Title | 17.6 pt | Bold | Black |
| Artist | 14 pt | Regular | Black |
| BPM and meter | 12 pt | Italic | Black |
| Key and capo | 17.6 pt | Regular | Black |
| Arrangement notes | 15.5 pt | Italic | `#444444` |
| Section heading | 17.5 pt | Bold uppercase | Section color |
| Chord | 16 pt | Bold | `#1a55d4` |
| Lyric | 17.6 pt | Regular or bold | Black |
| Instruction | 15.5 pt | Italic | `#cc00cc` |
| Page count | 9 pt | Regular | `#787878` |

Normal vertical advancement is 1.35 times the effective font size.

## Per-section text size

Each section's **Text** control scales its heading, chords, lyrics, instructions, blank spacing, and section-leading space from 100% through 200% in 10% steps.

This is a base-size multiplier. Long-line fitting can reduce an individual rendered line after the section scale is applied. Metadata and arrangement notes are not affected by a section's text setting.

## Color language

| Meaning | Color |
| --- | --- |
| Intro heading | `#cc00cc` |
| Chorus heading | `#217a14` |
| Bridge heading | `#6a1f9a` |
| Outro heading | `#6b6b6b` |
| Instrumental heading | `#1a55d4` |
| Custom heading | `#9b5c00` |
| Chords | `#1a55d4` |
| Instructions | `#cc00cc` |
| Verse 1 number | `#cc1800` |
| Verse 2 number | `#ff7a00` |
| Verse 3 number | `#8a2be2` |
| Verse 4 number | `#0070c0` |
| Verse 5 number | `#00b050` |
| Verse 6 through 99 numbers | `#6b6b6b` |

## Arrangement notes

Arrangement notes are centered between the metadata stack and first section. They are the only content type that intentionally wraps.

The notes use italic dark-gray text inside a square-bracket motif:

- vertical rules sit 68 pt from each page edge;
- bracket strokes are `#666666` at 1.25 pt;
- 9 pt caps form the top and bottom corners;
- text wraps within an inner width of approximately 430 pt;
- the block adds padding above and below the text.

## Sections

Each section begins after a scale-aware vertical spacer unless pagination moves it to a new page. Non-verse sections show a centered uppercase heading. Verse sections do not print the word `VERSE`.

Non-verse repeat counts append a multiplication suffix, such as `CHORUS × 2`. Verse repeat values are not printed.

Custom sections use the configured custom label, uppercased. An empty custom label falls back to `SECTION`.

### Verse numbering

The first rendered lyric in a verse receives a colored prefix such as `[2]` and is bold. Chord rows before that lyric do not consume the first-lyric position. For a Chord + Lyric row, the lyric portion receives the prefix.

### Chord rows

Chord rows are centered, blue, and bold. The exporter uses proportional Helvetica, not a fixed-width chord grid. Spaces are preserved only to the extent supported by PDF text placement and font metrics.

### Lyric rows

Lyrics are centered and black. The **B** line control makes the full lyric bold.

Text between paired `**` markers is rendered bold. The markers are removed from output. If the entire line is already bold, marked text remains bold.

### Instruction rows

Instructions are centered, italic, and magenta. The exporter does not add punctuation or parentheses; include them in the stored text if they should print.

### Chord + Lyric rows

A combined row renders as a blue bold chord line followed by a black lyric line. There is no visible cell, border, or background.

The two parts are paginated independently. A page break can therefore occur between the chord and lyric portions.

### Blank rows

A Blank row emits no text. It advances vertically by one scaled lyric line height and participates in pagination.

## Long-line fitting

Titles, metadata, section headings, chords, lyrics, and instructions are single-line elements. When a line exceeds the 532 pt content width, its font size is reduced proportionally.

Reduction stops at 60% of the line's base size after section scaling. A line that is still too wide at that floor can extend beyond the content area or page edge. These elements do not wrap.

Arrangement notes are the only wrapping content type.

## Pagination

Before a section starts, the exporter budgets for:

- the section-leading spacer;
- the section heading, when present;
- the first rendered line.

If that group does not fit, the section begins at the top margin of a new page and omits the leading spacer. This prevents an orphaned heading.

After the first line, each row is evaluated independently. Consequences:

- a section can continue on the next page;
- its heading is not repeated;
- a Chord + Lyric row can split between its two parts;
- a large arrangement-note block is kept together and can overflow because it is not split across pages.

## Preview differences

The browser preview is an editing aid, not a PDF renderer.

| Area | Preview | PDF |
| --- | --- | --- |
| Canvas | CSS paper with radius and shadow | Plain PDF page |
| Typeface | Helvetica Neue, Helvetica, or Arial | Helvetica |
| Original key | Separate display line | Appended to the current-key line |
| Instructions | Browser preview styling | `#cc00cc`, italic |
| Page breaks | Estimated from browser layout | Explicit jsPDF measurement and page budgeting |
| Theme | Affects surrounding interface | Never affects output |

Always inspect the exported PDF before printing or distributing it.

## Included and excluded data

The PDF includes:

- title and artist;
- tempo, meter, keys, and capo;
- arrangement notes;
- section labels and repeat cues;
- chords, lyrics, instructions, and blank spacing;
- page counts.

It excludes:

- chart ID;
- group, status, source, and Info notes;
- favorites;
- versions and collected-section metadata;
- editor collapse state and editor height;
- application theme and interface controls.

## Filename

The filename begins with the chart title. Only ASCII letters, digits, and spaces are retained; surrounding spaces are removed. If no usable characters remain, the filename is `chart.pdf`.

Examples:

| Title | Filename |
| --- | --- |
| `The Weight` | `The Weight.pdf` |
| `Song: Live!` | `Song Live.pdf` |
| `!!!` | `chart.pdf` |

## Known limitations

- PDFs are not tagged for accessibility and have no bookmarks or semantic structure.
- Very long single lines can overflow after reaching the 60% fitting floor.
- Arrangement-note blocks do not split across pages.
- Chord and lyric parts of a combined row can split across pages.
- Section headings are not repeated when a section continues.
- Browser and PDF font metrics differ slightly.
- The exporter supports US Letter only.

## Contributor verification

For any change that can affect PDF output:

1. Run `node --test tests/pdf-font-consistency.test.js`.
2. Run the complete JavaScript test suite.
3. Export a chart containing every metadata field, section type, repeat, verses 1–6, all five line types, per-section text scales, full-line bold, and inline bold.
4. Include enough content to create multiple pages and place a combined row near a page boundary.
5. Render or open every PDF page and inspect hierarchy, colors, weights, bracket alignment, blank spacing, page splits, clipping, and footer placement.
6. Confirm the page is 612 × 792 pt.
7. Confirm Info fields do not appear.
8. Compare the preview for intentional consistency, but verify final pagination against the PDF.
