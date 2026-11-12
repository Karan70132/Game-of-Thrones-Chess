import json

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST

from .forms import ProfileForm
from .houses import AVATAR_LIST, HOUSES
from .models import profile_for


@login_required
def profile(request):
    player = profile_for(request.user)
    form = ProfileForm(request.POST or None, instance=player)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Your banner is raised.")
        return redirect("profile")
    return render(request, "profile.html", {"form": form, "houses": HOUSES, "avatars": AVATAR_LIST})


@login_required
@require_POST
def record_result(request):
    try:
        result = json.loads(request.body)["result"]
    except (KeyError, ValueError, TypeError):
        return JsonResponse({"error": "Invalid request"}, status=400)
    field = {"win": "wins", "loss": "losses", "draw": "draws"}.get(result)
    if not field:
        return JsonResponse({"error": "Invalid result"}, status=400)
    player = profile_for(request.user)
    setattr(player, field, getattr(player, field) + 1)
    player.save(update_fields=[field, "updated"])
    return JsonResponse({"wins": player.wins, "losses": player.losses, "draws": player.draws})
