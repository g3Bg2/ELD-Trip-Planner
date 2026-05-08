from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def root(_request):
    return JsonResponse({
        'service': 'ELD Trip Planner API',
        'endpoints': {
            'health': '/api/health/',
            'plan_trip': 'POST /api/plan/',
            'trip_detail': 'GET /api/trips/<id>/',
        },
    })


urlpatterns = [
    path('', root),
    path('admin/', admin.site.urls),
    path('api/', include('trips.urls')),
]
