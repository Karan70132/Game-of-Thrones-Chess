import json
import math
import os
import urllib.request
from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from kingdom.forms import SignupForm
from kingdom.houses import AVATAR_LIST, HOUSES
from kingdom.models import profile_for
from django.http import Http404, JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_POST

def home(request):
    return render(request,"home.html")

def signup(request):
    if request.user.is_authenticated:
        return redirect("play")
    initial = {"house": request.GET.get("house")} if request.GET.get("house") in HOUSES else None
    form = SignupForm(request.POST if request.method=="POST" else None, initial=initial)
    if request.method=="POST" and form.is_valid():
        user = form.save()
        player = profile_for(user)
        player.house = form.cleaned_data["house"]
        player.avatar = form.cleaned_data.get("avatar") or ""
        player.save(update_fields=["house", "avatar"])
        login(request, user)
        return redirect("play")
    return render(request,"account.html",{"form":form,"signup":True,"avatars":AVATAR_LIST})

@never_cache
@login_required
def play(request):
    return render(request,"play.html")

def legacy(request):
    root = settings.BASE_DIR / "original"
    files = sorted(p.name for p in root.iterdir() if p.suffix in {".cpp",".h"})
    name = request.GET.get("file","main.cpp")
    if name not in files:
        raise Http404
    return render(request,"legacy.html",{"files":files,"name":name,"source":(root/name).read_text()})

def load_model():
    path = settings.BASE_DIR/"models"/"rook-eval.json"
    if not path.exists():
        return None
    if path.stat().st_size > 12_000_000:
        raise ValueError("Model file too large")
    model = json.loads(path.read_text())
    finite = lambda rows: all(math.isfinite(x) for row in rows for x in row)
    if model.get("format") == "rook-eval-v2":
        l1, l2, out = model["l1"], model["l2"], model["out"]
        h1, h2 = len(l1["b"]), len(l2["b"])
        if len(l1["w"]) != 768 or not 8 <= h1 <= 512 or any(len(r) != h1 for r in l1["w"]):
            raise ValueError("Wrong first layer")
        if len(l2["w"]) != h1 or not 4 <= h2 <= 64 or any(len(r) != h2 for r in l2["w"]) or len(out["w"]) != h2:
            raise ValueError("Wrong hidden layers")
        if "psqt" in model and len(model["psqt"]) != 768:
            raise ValueError("Wrong skip layer")
        if not (finite(l1["w"]) and finite(l2["w"]) and finite([l1["b"], l2["b"], out["w"], model.get("psqt", []), [out["b"], model.get("scale", 400)]])):
            raise ValueError("Nonfinite weight")
        return model
    if model.get("format")!="rook-eval-v1" or len(model["w"])!=768:
        raise ValueError("Wrong input schema")
    width = len(model["b"])
    if not 1<=width<=128 or len(model["v"])!=width or any(len(row)!=width for row in model["w"]):
        raise ValueError("Wrong layer dimensions")
    if not all(math.isfinite(x) for row in [*model["w"],model["b"],model["v"],[model["c"]]] for x in row):
        raise ValueError("Nonfinite weight")
    return model

@never_cache
@login_required
def weights(request):
    try:
        return JsonResponse({"model":load_model()})
    except (TypeError, ValueError, KeyError, OSError):
        return JsonResponse({"error":"Invalid rook-eval.json"},status=422)

@login_required
@require_POST
def coach(request):
    endpoint = os.getenv("OLLAMA_URL", "" if settings.PRODUCTION else "http://127.0.0.1:11434")
    if not endpoint:
        return JsonResponse({"error":"Coach unavailable"},status=503)
    try:
        prompt = json.loads(request.body)["prompt"]
        if not isinstance(prompt,str) or len(prompt)>3000:
            raise ValueError
    except (KeyError, ValueError, TypeError):
        return JsonResponse({"error":"Invalid request"},status=400)
    payload = {"model":os.getenv("OLLAMA_MODEL","qwen2.5:3b"),"prompt":prompt,"stream":False,"options":{"num_predict":120}}
    req = urllib.request.Request(endpoint.rstrip("/")+"/api/generate",data=json.dumps(payload).encode(),headers={"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(req,timeout=22) as response:
            return JsonResponse({"answer":json.load(response)["response"]})
    except (OSError,ValueError,KeyError):
        return JsonResponse({"error":"Coach unavailable"},status=503)
