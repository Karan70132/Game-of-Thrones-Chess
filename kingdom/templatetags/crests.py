"""{% crest player %} / {% house_crest "knight" %} / {% robo_crest %} — heraldic shields as inline SVG."""
from itertools import count

from django import template
from django.utils.html import escape
from django.utils.safestring import mark_safe

from kingdom.houses import HOUSES

register = template.Library()
_ids = count(1)
SHIELD = "M50 3 L94 13 L94 56 C94 86 74 105 50 117 C26 105 6 86 6 56 L6 13 Z"
INNER = "M50 10 L87 18.5 L87 56 C87 81 70 97.5 50 108 C30 97.5 13 81 13 56 L13 18.5 Z"


def _svg(field, metal, piece, side="w", photo="", label=""):
    uid = f"sc{next(_ids)}"
    if photo:
        art = (f'<image href="{escape(photo)}" x="0" y="0" width="100" height="120" '
               f'preserveAspectRatio="xMidYMid slice" clip-path="url(#{uid}c)"/>')
    else:
        art = f'<image href="/static/img/pieces/{side}{piece}.webp" x="9" y="13" width="82" height="82"/>'
    role = f'role="img" aria-label="{escape(label)}"' if label else 'aria-hidden="true"'
    return mark_safe(
        f'<span class="crest"><svg viewBox="0 0 100 120" {role}><defs>'
        f'<linearGradient id="{uid}g" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="{field}"/>'
        f'<stop offset="1" stop-color="{field}" stop-opacity=".72"/></linearGradient>'
        f'<linearGradient id="{uid}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/>'
        f'<stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>'
        f'<clipPath id="{uid}c"><path d="{SHIELD}"/></clipPath></defs>'
        f'<path d="{SHIELD}" fill="#0b0a08"/><path d="{SHIELD}" fill="url(#{uid}g)"/>{art}'
        f'<path d="{SHIELD}" fill="url(#{uid}s)"/><path d="{SHIELD}" fill="none" stroke="{metal}" stroke-width="4.5"/>'
        f'<path d="{INNER}" fill="none" stroke="{metal}" stroke-opacity=".5" stroke-width="1.3"/></svg></span>'
    )


@register.simple_tag
def crest(player, label=""):
    h = player.crest
    return _svg(h["field"], h["metal"], h["piece"], "w", player.picture or h.get("sigil", ""), label)


@register.simple_tag
def house_crest(key, label=""):
    h = HOUSES.get(key, HOUSES["knight"])
    return _svg(h["field"], h["metal"], h["piece"], "w", h.get("sigil", ""), label)


@register.simple_tag
def robo_crest(label=""):
    return _svg("#cfd9df", "#2a3442", "K", "b", "", label)
