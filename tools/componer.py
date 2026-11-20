"""Composición de la música de Claude Street (Re menor, 140 BPM).

Genera las notas de 4 temas x 4 pistas. El resultado se envía a Ableton
(una escena por tema) y se guarda en docs/assets/musica.json para el juego.
Tiempos en pulsos (negras), alturas en MIDI (C4 = 60).
"""
import json
import sys

TEMPO = 140
# batería (mapa General MIDI / kits de Ableton)
KICK, SNARE, CLAP, HAT, OHAT, CRASH, TOM_H, TOM_M, TOM_L = 36, 38, 39, 42, 46, 49, 50, 47, 45


def n(p, t, d, v=100):
    return {"pitch": int(p), "start_time": round(float(t), 4), "duration": round(float(d), 4), "velocity": int(v), "mute": False}


def melody(seq, start=0.0, vel=100, legato=0.92, base=0.0):
    """seq: lista de (nota|None, duración)."""
    out, t = [], start
    for p, d in seq:
        if p is not None:
            out.append(n(p, base + t, d * legato, vel))
        t += d
    return out, t


# ------------------------------------------------------------------ MENÚ (8 compases, solemne)
def tema_menu():
    chords = [([50, 53, 57], 38), ([50, 53, 58], 34), ([52, 55, 60], 36), ([49, 52, 57], 33)]  # Dm Bb C A
    pad, bass = [], []
    for i, (notes, root) in enumerate(chords):
        t = i * 8
        pad += [n(p, t, 7.9, 64) for p in notes]
        bass += [n(root, t, 3.6, 92), n(root, t + 4, 3.0, 84), n(root + 12, t + 7, 0.9, 70)]
    lead, _ = melody([
        (69, 2), (74, 1), (76, 1), (77, 3), (76, 1),
        (74, 2), (77, 1), (74, 1), (70, 4),
        (72, 2), (76, 1), (79, 1), (77, 2), (76, 2),
        (76, 3), (73, 1), (69, 4),
    ], vel=96, legato=0.97)
    drums = []
    for b in range(8):
        t = b * 4
        drums.append(n(KICK, t, 0.25, 110))
        drums.append(n(SNARE, t + 2, 0.25, 96))
        if b % 2 == 1:
            drums.append(n(KICK, t + 3.5, 0.25, 80))
        for k in range(8):
            drums.append(n(HAT, t + k * 0.5, 0.1, 58 if k % 2 else 72))
    drums.append(n(CRASH, 0, 1, 100))
    drums += [n(TOM_H, 31, 0.2, 90), n(TOM_M, 31.25, 0.2, 92), n(TOM_L, 31.5, 0.2, 96), n(TOM_L, 31.75, 0.2, 100)]
    return 32, {"lead": lead, "bass": bass, "pad": pad, "drums": drums}


# ------------------------------------------------------------------ SELECCIÓN (4 compases, arpegios)
def tema_seleccion():
    chords = [(62, [62, 69, 74, 69, 77, 69, 74, 69], 38, [50, 53, 57]),   # Dm
              (58, [58, 65, 70, 65, 74, 65, 70, 65], 34, [50, 53, 58]),   # Bb
              (60, [60, 67, 72, 67, 76, 67, 72, 67], 36, [52, 55, 60]),   # C
              (57, [57, 64, 69, 64, 73, 64, 69, 64], 33, [49, 52, 57])]   # A
    lead, bass, pad, drums = [], [], [], []
    for b, (_, arp, root, tri) in enumerate(chords):
        t0 = b * 4
        for k in range(16):
            lead.append(n(arp[k % 8], t0 + k * 0.25, 0.22, 100 if k % 4 == 0 else 78))
        for k in range(8):
            bass.append(n(root + (12 if k % 2 else 0), t0 + k * 0.5, 0.42, 96 if k % 2 == 0 else 80))
        pad += [n(p, t0, 3.9, 52) for p in tri]
        for k in range(4):
            drums.append(n(KICK, t0 + k, 0.25, 112))
            drums.append(n(OHAT, t0 + k + 0.5, 0.2, 70))
        drums += [n(CLAP, t0 + 1, 0.25, 96), n(CLAP, t0 + 3, 0.25, 100)]
    drums.append(n(CRASH, 0, 1, 90))
    return 16, {"lead": lead, "bass": bass, "pad": pad, "drums": drums}


# ------------------------------------------------------------------ COMBATE (16 compases, agresivo)
def tema_combate():
    D, F, G, A, Bb, C = 38, 41, 43, 45, 46, 48
    roots = [D, D, Bb - 12, C - 12, D, D, G - 12, A - 12, Bb - 12, C - 12, D, D, G - 12, A - 12, D, A - 12]
    # fix octave: queremos bajo entre 33 y 45
    roots = [r if r >= 33 else r + 12 for r in roots]
    lead_seq = [
        # 1-2 Dm
        (74, .5), (74, .5), (77, .5), (74, .5), (81, 1), (79, .5), (77, .5),
        (76, 1), (77, .5), (76, .5), (74, 1.5), (None, .5),
        # 3 Bb, 4 C
        (77, .5), (77, .5), (82, .5), (81, .5), (79, 1), (77, 1),
        (76, .5), (79, .5), (84, 1), (82, .5), (81, .5), (79, 1),
        # 5-6 Dm
        (74, .5), (74, .5), (77, .5), (74, .5), (81, 1), (79, .5), (77, .5),
        (76, 1), (77, .5), (79, .5), (81, 2),
        # 7 Gm, 8 A
        (82, .5), (81, .5), (79, .5), (74, .5), (79, 1), (81, .5), (82, .5),
        (81, 1.5), (79, .5), (77, .5), (76, .5), (73, 1),
        # 9 Bb, 10 C
        (86, 1), (84, .5), (82, .5), (77, 1), (82, 1),
        (84, 1), (82, .5), (81, .5), (79, 1), (76, 1),
        # 11-12 Dm
        (77, .5), (76, .5), (74, .5), (76, .5), (77, .5), (79, .5), (81, 1),
        (86, 2), (81, 1), (77, 1),
        # 13 Gm, 14 A
        (79, .5), (82, .5), (86, .5), (82, .5), (79, 1), (74, 1),
        (76, .5), (81, .5), (85, 1), (88, .5), (85, .5), (81, 1),
        # 15 Dm, 16 A
        (86, 1.5), (81, .5), (77, 1), (74, 1),
        (76, .5), (77, .5), (79, .5), (81, .5), (85, 1), (88, 1),
    ]
    lead, end = melody(lead_seq, vel=104, legato=0.88)
    assert abs(end - 64) < 1e-6, end
    bass, pad, drums = [], [], []
    minor = {D: [0, 3, 7], G: [0, 3, 7]}
    for b, r in enumerate(roots):
        t0 = b * 4
        for k, off in enumerate([0, 0, 12, 0, 0, 12, 0, 12]):
            bass.append(n(r + off, t0 + k * 0.5, 0.42, 104 if k in (0, 3, 6) else 84))
        # acordes de potencia en octava 3-4
        pr = r + 12
        pad += [n(pr, t0, 3.9, 60), n(pr + 7, t0, 3.9, 56), n(pr + 12, t0, 3.9, 52)]
        # batería
        drums += [n(KICK, t0, 0.25, 118), n(KICK, t0 + 1.5, 0.25, 104), n(KICK, t0 + 2.5, 0.25, 108)]
        if b % 4 == 3:
            drums.append(n(KICK, t0 + 3.75, 0.2, 96))
        drums += [n(SNARE, t0 + 1, 0.25, 110), n(SNARE, t0 + 3, 0.25, 114)]
        for k in range(16):
            drums.append(n(HAT, t0 + k * 0.25, 0.08, 74 if k % 2 == 0 else 46))
    drums += [n(CRASH, 0, 1.5, 110), n(CRASH, 32, 1.5, 110)]
    # redoble de toms al final
    for k, tom in enumerate([TOM_H, TOM_H, TOM_M, TOM_M, TOM_L, TOM_L, TOM_L, SNARE]):
        drums.append(n(tom, 62 + k * 0.25, 0.2, 90 + k * 4))
    return 64, {"lead": lead, "bass": bass, "pad": pad, "drums": drums}


# ------------------------------------------------------------------ VICTORIA (fanfarria, sin bucle)
def tema_victoria():
    lead, _ = melody([(69, 1 / 3), (74, 1 / 3), (78, 1 / 3), (81, 1), (78, .5), (81, .5), (86, 4.5)], vel=110, legato=0.95)
    pad = [n(p, 0, 1.45, 70) for p in [55, 59, 62]] + [n(p, 1.5, 1.45, 72) for p in [57, 61, 64]] + \
          [n(p, 3, 4.8, 78) for p in [50, 54, 57, 62]]
    bass = [n(43, 0, 1.4, 100), n(45, 1.5, 1.4, 100), n(38, 3, 4.8, 110)]
    drums = [n(SNARE, k * 0.125, 0.1, 50 + k * 3) for k in range(24)]
    drums += [n(KICK, 3, 0.3, 124), n(CRASH, 3, 3, 120), n(KICK, 4.5, 0.3, 100), n(KICK, 5, 0.3, 110)]
    return 8, {"lead": lead, "bass": bass, "pad": pad, "drums": drums}


THEMES = [  # orden = escena en Ableton
    ("menu", "Menú", True, tema_menu),
    ("seleccion", "Selección", True, tema_seleccion),
    ("combate", "Combate", True, tema_combate),
    ("victoria", "Victoria", False, tema_victoria),
]
TRACKS = ["lead", "bass", "pad", "drums"]

if __name__ == "__main__":
    out = {"tempo": TEMPO, "tracks": TRACKS, "themes": {}}
    for key, name, loop, fn in THEMES:
        length, parts = fn()
        out["themes"][key] = {"name": name, "length": length, "loop": loop, "parts": parts}
    path = sys.argv[1] if len(sys.argv) > 1 else "musica.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    for key, th in out["themes"].items():
        print(key, th["length"], {k: len(v) for k, v in th["parts"].items()})
