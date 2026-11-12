from django.urls import path
from django.views.generic import RedirectView
from django.contrib.auth.views import LoginView, LogoutView
from . import views
from kingdom import views as kingdom_views
urlpatterns = [
    path("",views.home,name="home"),path("play/",views.play,name="play"),
    path("login/",LoginView.as_view(template_name="account.html",redirect_authenticated_user=True),name="login"),
    path("signup/",views.signup,name="signup"),path("logout/",LogoutView.as_view(),name="logout"),
    path("original/",views.legacy,name="original"),path("api/model/",views.weights),
    path("api/coach/",views.coach),
    path("profile/",kingdom_views.profile,name="profile"),path("api/result/",kingdom_views.record_result),
]
