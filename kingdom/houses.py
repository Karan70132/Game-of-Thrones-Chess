"""Great houses of Westeros for player crests. Sigil pictures (dist/img/houses/) and character portraits
(dist/img/avatars/*.webp) were supplied by the site owner."""

HOUSES = {
    "knight": {"name": "House Stark", "seat": "Winterfell", "words": "Winter is coming.", "piece": "N", "field": "#4a5560", "metal": "#e8ecef", "sigil": "/static/img/houses/stark.webp"},
    "bishop": {"name": "House Lannister", "seat": "Casterly Rock", "words": "Hear me roar!", "piece": "B", "field": "#8c1c1c", "metal": "#e8c05a", "sigil": "/static/img/houses/lannister.webp"},
    "queen": {"name": "House Targaryen", "seat": "Dragonstone", "words": "Fire and blood.", "piece": "Q", "field": "#151214", "metal": "#c8262c", "sigil": "/static/img/houses/targaryen.webp"},
    "king": {"name": "House Baratheon", "seat": "Storm's End", "words": "Ours is the fury.", "piece": "K", "field": "#d9a520", "metal": "#1a1714", "sigil": "/static/img/houses/baratheon.webp"},
    "rook": {"name": "House Greyjoy", "seat": "Pyke", "words": "We do not sow.", "piece": "R", "field": "#16171a", "metal": "#c9a23a", "sigil": "/static/img/houses/greyjoy.webp"},
    "pawn": {"name": "House Tyrell", "seat": "Highgarden", "words": "Growing strong.", "piece": "P", "field": "#2f6b34", "metal": "#e8c05a", "sigil": "/static/img/houses/tyrell.webp"},
}
HOUSE_CHOICES = [(key, value["name"]) for key, value in HOUSES.items()]

TITLES = [
    "Hand of the King", "Lord Commander", "Warden of the North", "Master of Whisperers", "Master of Coin",
    "Grand Maester", "Knight of the Seven Kingdoms", "Breaker of Pins", "Protector of the Realm", "Lord of the Seven Kingdoms",
]
TITLE_CHOICES = [("", "No title")] + [(t, t) for t in TITLES]

# Avatars: character portraits supplied by the site owner (dist/img/avatars/*.webp).
PORTRAITS = {
    "jon": "Jon Snow", "daenerys": "Daenerys Targaryen", "tyrion": "Tyrion Lannister", "arya": "Arya Stark",
    "sansa": "Sansa Stark", "ned": "Eddard Stark", "cersei": "Cersei Lannister", "jaime": "Jaime Lannister",
    "tywin": "Tywin Lannister", "bran": "Bran Stark", "oberyn": "Oberyn Martell", "jorah": "Jorah Mormont",
    "sam": "Samwell Tarly", "nightking": "The Night King",
}
AVATARS = dict(PORTRAITS)
AVATAR_CHOICES = [("", "House sigil")] + list(AVATARS.items())


def avatar_src(key):
    return f"/static/img/avatars/{key}.webp" if key in AVATARS else ""


AVATAR_LIST = [(key, name, avatar_src(key)) for key, name in AVATARS.items()]
