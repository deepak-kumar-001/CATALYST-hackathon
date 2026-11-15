import Portal from "@/components/Portal";
export default function MedsPage({ params }: { params: { id: string } }) { return <Portal profileId={params.id} section="meds" />; }
