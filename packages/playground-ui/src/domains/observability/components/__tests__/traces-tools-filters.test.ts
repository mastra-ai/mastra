import { describe, it, expect } from 'vitest';
import { TracesTools } from '../traces-tools';

/**
 * Tests for Issue #14005: Filter and search traces by metadata and tags.
 *
 * These tests verify that the TracesTools component exposes filter controls
 * for searching/filtering traces by metadata, tags, and error status.
 *
 * The tests inspect the component function source to verify it references
 * the expected props. This will fail until the component is updated.
 */

describe('TracesTools filter capabilities (Issue #14005)', () => {
  const componentSource = TracesTools.toString();

  it('should render a search input for free-text search across metadata', () => {
    // TracesTools should destructure and use a searchQuery/onSearchChange prop
    expect(componentSource).toContain('searchQuery');
    expect(componentSource).toContain('onSearchChange');
  });

  it('should render tag filter controls', () => {
    // TracesTools should destructure and use tag filter props
    expect(componentSource).toContain('selectedTags');
    expect(componentSource).toContain('onTagsChange');
  });

  it('should render an error-only toggle', () => {
    // TracesTools should destructure and use error-only filter props
    expect(componentSource).toContain('errorOnly');
    expect(componentSource).toContain('onErrorOnlyChange');
  });

  it('should render metadata key-value filter controls', () => {
    // TracesTools should destructure and use metadata filter props
    expect(componentSource).toContain('metadataFilters');
    expect(componentSource).toContain('onMetadataFiltersChange');
  });
});
