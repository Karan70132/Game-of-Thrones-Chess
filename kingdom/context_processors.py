from .houses import HOUSES
from .models import profile_for


def player(request):
    """Expose the signed-in player's profile (crest, title, record) to every template."""
    if request.user.is_authenticated:
        return {"player": profile_for(request.user), "houses": HOUSES}
    return {"houses": HOUSES}
