export function BrandMark() {
  return (
    <a className="brand" href="#top" aria-label="What Can I Cook? home">
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-fridge">
          <span className="brand-shelf brand-shelf-top" />
          <span className="brand-shelf brand-shelf-bottom" />
          <span className="brand-produce" />
          <span className="brand-door"><span className="brand-handle" /></span>
        </span>
      </span>
      <span className="brand-name">What Can I Cook?</span>
    </a>
  );
}
