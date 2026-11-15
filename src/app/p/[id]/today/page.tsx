import Portal from "@/components/Portal";
export default function TodayPage({ params }: { params: { id: string } }) { return <Portal profileId={params.id} section="today" />; }
