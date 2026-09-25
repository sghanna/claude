# Draws the game title as SVG paths into ../wordmark.js (run with fontTools and uharfbuzz installed:
#   pip install fonttools uharfbuzz; then run from a folder holding the font files named below,
#   downloaded from github.com/google/fonts, ofl/<family>/). Add a word to WORDS when a language gets a new title.
# Turn the word "Hearts" in six open-license (SIL OFL) fonts into SVG paths, with the fonts' own kerning.
import json, io
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

WORDS = {'fraunces': ['Hearts', 'Corazones']}   # the title in each language; the others were options only
OPTIONS = [
  ('abril', 'Abril Fatface', 'AbrilFatface-Regular.ttf', None),
  ('playfair', 'Playfair Display Black', 'PlayfairDisplay[wght].ttf', {'wght': 900}),
  ('dmserif', 'DM Serif Display', 'DMSerifDisplay-Regular.ttf', None),
  ('yeseva', 'Yeseva One', 'YesevaOne-Regular.ttf', None),
  ('fraunces', 'Fraunces Black, soft', 'Fraunces[SOFT,WONK,opsz,wght].ttf', {'wght': 900, 'opsz': 144, 'SOFT': 100, 'WONK': 0}),
  ('alfaslab', 'Alfa Slab One', 'AlfaSlabOne-Regular.ttf', None),
]
out = {}
for key, name, path, axes in OPTIONS:
    font = TTFont(path)
    if axes:
        font = instancer.instantiateVariableFont(font, axes)
    buf = io.BytesIO(); font.save(buf); data = buf.getvalue()
    font = TTFont(io.BytesIO(data))
    hbfont = hb.Font(hb.Face(data))
    gs = font.getGlyphSet(); order = font.getGlyphOrder()
    cap = font['OS/2'].sCapHeight
    words = {}
    for word in WORDS.get(key, ['Hearts']):
        b = hb.Buffer(); b.add_str(word); b.guess_segment_properties()
        hb.shape(hbfont, b, {'kern': True, 'liga': False})
        pen = SVGPathPen(gs, ntos=lambda v: str(round(v)))
        bounds = BoundsPen(gs)
        x = 0
        for info, pos in zip(b.glyph_infos, b.glyph_positions):
            g = order[info.codepoint]
            t = (1, 0, 0, -1, x + pos.x_offset, -pos.y_offset)   # flip y: SVG y grows downward
            gs[g].draw(TransformPen(pen, t)); gs[g].draw(TransformPen(bounds, t))
            x += pos.x_advance
        x0, y0, x1, y1 = bounds.bounds
        words[word] = {'d': pen.getCommands(), 'box': [round(x0), round(y0), round(x1 - x0), round(y1 - y0)]}
        print(key, word, words[word]['box'], 'cap', cap)
    out[key] = {'name': name, 'cap': cap, 'words': words}
js = '/* The game title drawn as paths (like the card faces): Fraunces, picked by Shawn, has "Hearts" and "Corazones"; the others were options. Fonts: SIL Open Font License,\n   from github.com/google/fonts. Screen readers never see these: the title stays text for them. */\nwindow.WORDMARKS = ' + json.dumps(out, separators=(',', ':')) + ';\n'
open(__import__('os').path.join(__import__('os').path.dirname(__file__), '..', 'wordmark.js'), 'w').write(js)
