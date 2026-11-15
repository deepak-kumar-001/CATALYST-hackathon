import Portal from "@/components/Portal";
export default function AppointmentsPage({ params }: { params: { id: string } }) { return <Portal profileId={params.id} section="appointments" />; }
