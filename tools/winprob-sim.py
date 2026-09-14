# Monte Carlo of Torn fights using the Attacking 2.0 hit/mitigation/damage curves confirmed in the 13 Sep research
# (github.com/wjrsndml/tornattacksim reproduces the wiki tables). Both players balanced builds, equal weapons/armor,
# 25 turns then stalemate, attacker acts first. Outputs win probability vs attacker/defender total-stat ratio.
import math, random
random.seed(7)

def hit_chance(spd_att, dex_def):
    r = spd_att / dex_def
    if r >= 64: return 1.0
    if r >= 1: return (100 - (50/7)*(8/math.sqrt(r) - 1))/100
    if r > 1/64: return ((50/7)*(8*math.sqrt(r) - 1))/100
    return 0.0

def mitigation(def_def, str_att):
    d = def_def / str_att
    if d >= 14: return 1.0
    if d >= 1: return (50 + (50/math.log(14))*math.log(d))/100
    if d > 1/32: return (50 + (50/math.log(32))*math.log(d))/100
    return 0.0

def max_damage(strength):
    x = math.log10(strength/10)
    return 7*x*x + 27*x + 30

WEAPON = 1 + math.log(60)   # ~5.1: a mid-tier primary (base damage ~60)
ARMOR = 0.30                # 30% armor on both
LIFE = 2500

def fight(att_total, def_total, turns=25):
    a = att_total/4; d = def_total/4
    a_life = d_life = LIFE
    for _ in range(turns):
        # attacker turn
        if random.random() < hit_chance(a, d):
            dmg = max_damage(a) * WEAPON * random.uniform(0.6, 1.0) * (1 - mitigation(d, a)) * (1 - ARMOR)
            d_life -= dmg
            if d_life <= 0: return 'win'
        # defender turn
        if random.random() < hit_chance(d, a):
            dmg = max_damage(d) * WEAPON * random.uniform(0.6, 1.0) * (1 - mitigation(a, d)) * (1 - ARMOR)
            a_life -= dmg
            if a_life <= 0: return 'loss'
    return 'stalemate'

def run(ratio_def_over_att, n=4000, att_total=4_000_000):
    wins = losses = stales = 0
    for _ in range(n):
        r = fight(att_total, att_total*ratio_def_over_att)
        if r == 'win': wins += 1
        elif r == 'loss': losses += 1
        else: stales += 1
    return wins/n, losses/n, stales/n

print("defender/attacker stats | score ratio | FF   | win   | loss  | stalemate")
for stats_ratio in [0.02, 0.05, 0.10, 0.20, 0.30, 0.40, 0.50, 0.56, 0.70, 0.85, 1.00, 1.30, 1.70, 2.50]:
    score_ratio = math.sqrt(stats_ratio)
    ff = min(3.0, 1 + 8/3*score_ratio)
    w, l, s = run(stats_ratio)
    print(f"{stats_ratio:>22.2f} | {score_ratio:>11.2f} | {ff:>4.2f} | {w:>5.2f} | {l:>5.2f} | {s:>5.2f}")
