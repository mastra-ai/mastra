configure_file(hdr/hdr_histogram_version.h hdr/hdr_histogram_version.h @ONLY)

set(HDR_HISTOGRAM_PUBLIC_HEADERS
    hdr/hdr_histogram.h
    hdr/hdr_histogram_log.h
    hdr/hdr_interval_recorder.h
    hdr/hdr_thread.h
    hdr/hdr_time.h
    hdr/hdr_writer_reader_phaser.h
    hdr/hdr_histogram_version.h)

install(
    FILES ${HDR_HISTOGRAM_PUBLIC_HEADERS}
    DESTINATION ${CMAKE_INSTALL_INCLUDEDIR}/hdr)
