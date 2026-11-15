import Portal from "@/components/Portal";
export default function AdherencePage({ params }: { params: { id: string } }) { return <Portal profileId={params.id} section="adherence" />; }
