from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Trip
from .serializers import TripInputSerializer, TripSerializer
from .services import routing
from .services.hos import plan_trip


@api_view(['GET'])
def health(_request):
    return Response({'status': 'ok'})


@api_view(['POST'])
def plan(request):
    serializer = TripInputSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data

    try:
        current = routing.geocode(data['current_location'])
        pickup = routing.geocode(data['pickup_location'])
        dropoff = routing.geocode(data['dropoff_location'])
        leg1 = routing.route([current, pickup])
        leg2 = routing.route([pickup, dropoff])
    except routing.RoutingError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    plan_data = plan_trip(
        current=current,
        pickup=pickup,
        dropoff=dropoff,
        leg1=leg1,
        leg2=leg2,
        current_cycle_used_hours=data['current_cycle_used_hours'],
    )

    response_payload = {
        'inputs': data,
        'geocoded': {
            'current': current.to_dict(),
            'pickup': pickup.to_dict(),
            'dropoff': dropoff.to_dict(),
        },
        'route': {
            'total_distance_miles': round(
                leg1.distance_miles + leg2.distance_miles, 2
            ),
            'osrm_duration_hours': round(
                leg1.duration_hours + leg2.duration_hours, 2
            ),
            'leg1': {
                'distance_miles': round(leg1.distance_miles, 2),
                'duration_hours': round(leg1.duration_hours, 2),
                'geometry': leg1.geometry,
            },
            'leg2': {
                'distance_miles': round(leg2.distance_miles, 2),
                'duration_hours': round(leg2.duration_hours, 2),
                'geometry': leg2.geometry,
            },
        },
        'plan': plan_data,
    }

    trip = Trip.objects.create(
        current_location=data['current_location'],
        pickup_location=data['pickup_location'],
        dropoff_location=data['dropoff_location'],
        current_cycle_used_hours=data['current_cycle_used_hours'],
        total_distance_miles=leg1.distance_miles + leg2.distance_miles,
        total_duration_hours=plan_data['totals']['trip_duration_hours'],
        plan=response_payload,
    )
    response_payload['trip_id'] = trip.id

    return Response(response_payload, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def trip_detail(_request, trip_id: int):
    try:
        trip = Trip.objects.get(pk=trip_id)
    except Trip.DoesNotExist:
        return Response({'error': 'Trip not found.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(trip.plan or TripSerializer(trip).data)
