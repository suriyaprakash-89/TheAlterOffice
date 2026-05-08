export default function SharedBanner({ list }) {
  return (
    <div className="shared-banner">
      <strong>Publicly shared todo list</strong>
      <span>{list?.name || 'Shared list'}</span>
    </div>
  );
}
