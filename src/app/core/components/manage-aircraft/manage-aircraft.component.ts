import {Component, HostListener, OnDestroy, OnInit, Renderer2, ViewChild} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {BehaviorSubject, combineLatest, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {Aircraft} from "../../interfaces/aircraft";
import {ManageAircraftService} from "../../services/manage-aircraft/manage-aircraft.service";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {ToastrService} from "ngx-toastr";

@Component({
    selector: 'app-manage-aircraft',
    templateUrl: './manage-aircraft.component.html',
    styleUrls: ['./manage-aircraft.component.scss']
})
export class ManageAircraftComponent implements OnInit, OnDestroy {

    @ViewChild('manageAircraftModal') manageAircraftModal: any;
    @ViewChild('deleteConfirmModal') deleteConfirmModal: any;
    @ViewChild('imageModal') imageModal: any;

    protected readonly Math = Math;

    public duplicateConflict: Aircraft | null = null;

    public badImageText = `We can't find this image.`;

    public aircraft: Aircraft[] = [];
    public viewMode: 'ROW' | 'ICON' = 'ROW'; // Default to row view
    private modalRef: any;

    public sizeClasses: string[] = []; // To hold unique size classes for the dropdown
    public oem: string[] = [];

    /* FORM STUFF */
    public aircraftForm: FormGroup;
    public filterForm: FormGroup;
    public submitted = false;

    /* State tracking */
    private destroyed$ = new Subject<void>();
    public isEditing$: BehaviorSubject<boolean> = new BehaviorSubject(false);
    public hasScrolledToBottom$: BehaviorSubject<boolean> = new BehaviorSubject(false);
    public selectedId: number | null = null;

    /* Pagination, filtering, & sorting. */
    public pageIndex: number = 1;
    public pageSizeOptions = [6, 12, 24, 48];
    public pageSize: number = this.pageSizeOptions[1];
    public sortColumn: string = 'type';
    public sortDirection: 'ASC' | 'DESC' = 'ASC';

    /* Used to toggle the image thumbnail view in row display. */
    public ttImage = '';
    public imageTitle: string | undefined;

    constructor(
        private fb: FormBuilder,
        private aircraftService: ManageAircraftService,
        private readonly modalService: NgbModal,
        private readonly toastrService: ToastrService,
        private renderer: Renderer2
    ) {
        this.aircraftForm = this.fb.group({
            // General Info
            type: ['', [Validators.required, Validators.minLength(2)]],
            oem: ['', [Validators.required]],
            sizeClass: ['', [Validators.required]],
            category: ['Jet', [Validators.required]],
            variants: [[]],

            // Performance (Numerical constraints)
            seats: [null, [Validators.required, Validators.min(0)]],
            speedKnots: [null, [Validators.required, Validators.min(1)]],
            rangeNauticalMiles: [null, [Validators.required, Validators.min(1)]],
            runwayLengthFeet: [null, [Validators.min(0)]],

            // Technical/Media
            faaTypeCode: [''],
            tuvoliModelCode: [''],
            tuvoliModelDescription: [''],
            tuvoliExteriorImage: ['', [Validators.pattern('https?://.+')]],
            tuvoliInteriorImage1: ['', [Validators.pattern('https?://.+')]],
            tuvoliInteriorImage2: ['', [Validators.pattern('https?://.+')]],
            notes: ['']
        });

        this.filterForm = this.fb.group({
            search: [''],
            sizeClass: [''],
            oem: [''],
            variants: [''],
        });
    }

    ngOnInit(): void {

        /* Get aircraft and available options from service. */
        combineLatest({
            aircraftData: this.aircraftService.getAircraft(),
            sizeClassOptions: this.aircraftService.sizeClassOptions$,
            oemOptions: this.aircraftService.oemOptions$
        })
            .pipe(
                takeUntil(this.destroyed$)
            )
            .subscribe(({aircraftData, sizeClassOptions, oemOptions}) => {
                this.aircraft = aircraftData;
                this.sizeClasses = sizeClassOptions?.sizeClasses;
                this.oem = oemOptions?.oem;
            });

        this.filterForm.valueChanges
            .pipe(takeUntil(this.destroyed$))
            .subscribe(() => {
                /* Reset on new query. */
                this.pageIndex = 1;
            });

    }

    /**
     * Sets the image URL and opens the preview modal
     * @param imageUrl The URL of the clicked aircraft image
     */
    public openImagePreview(imageUrl: string): void {
        if (!imageUrl) return;

        // Set the component property used in the modal template
        this.ttImage = imageUrl;

        // Open the modal using NgbModal service
        this.modalService.open(this.imageModal, {
            centered: true,
            size: 'lg',
            windowClass: 'manage-aircraft-image-modal',
            container:'body'
        });
    }

    /**
     * Handles both Creating and Updating records
     */
    public onSubmit(): void {
        this.submitted = true;

        if (this.aircraftForm.invalid) {
            return;
        }

        if (this.modalRef) {
            this.modalRef.close();
        }

        const aircraftData: Aircraft = this.aircraftForm.value;
        const processedData: Aircraft = {
            ...aircraftData,
            variants: aircraftData.variants ? aircraftData.variants.map((v: string) => v.trim()) : []
        };

        if (this.isEditing$.getValue() && this.selectedId !== null) {
            // Update existing record
            this.aircraftService.updateAircraft({
                ...processedData,
                id: this.selectedId
            });
            this.toastrService.success('Aircraft has been updated.');
        } else {
            // Add new record
            this.aircraftService.addAircraft(processedData);
            this.toastrService.success('New Aircraft has been added.');
        }

        this.onReset();
    }

    /**
     * Resets form state and UI flags
     */
    onReset(): void {
        this.submitted = false;
        this.isEditing$.next(false);
        this.selectedId = null;
        this.duplicateConflict = null; // Clear conflict on reset
        this.aircraftForm.reset({
            category: 'Jet'
        });
    }

    /**
     * Populates the form with existing data for editing
     */
    public editAircraft(aircraft: Aircraft): void {

        this.openManageAircraftModal();

        this.isEditing$.next(true);
        this.selectedId = aircraft.id;
        this.submitted = false;

        this.aircraftForm.patchValue({
            ...aircraft,
            variants: Array.isArray(aircraft.variants) ? aircraft.variants : []
        });

        window.scrollTo({top: 0, behavior: 'smooth'});
    }

    /**
     * Deletes a record via the service
     */
    public deleteAircraft(id: number): void {
        this.modalService.open(this.deleteConfirmModal, {centered: true, size: 'md', container: 'body', windowClass: 'manage-aircraft-modal'}).result.then(
            () => {
                this.aircraftService.deleteAircraft(id);
                this.toastrService.success('Aircraft has been deleted successfully.');

                if (this.selectedId === id) {
                    this.onReset();
                }
            },
            () => { /* Deletion cancelled. */ }
        );
    }

    public toggleView(mode: 'ROW' | 'ICON'): void {
        this.viewMode = mode;
    }

    get f() {
        return this.aircraftForm.controls;
    }

    /* The getter is read several times per change-detection pass; only re-filter/sort when an input changed. */
    private filterCache?: { key: string, source: Aircraft[], result: Aircraft[] };

    get filteredAircraft(): Aircraft[] {
        const {search, sizeClass, oem} = this.filterForm.value;
        const searchTerm = (search || '').toLowerCase().trim();
        const key = JSON.stringify([searchTerm, sizeClass, oem, this.sortColumn, this.sortDirection]);

        if (this.filterCache?.source === this.aircraft && this.filterCache.key === key) {
            return this.filterCache.result;
        }

        /* FILTERING */
        const result = this.aircraft.filter(a => {
            const matchesPrimary = a.type.toLowerCase().includes(searchTerm) ||
                a.oem.toLowerCase().includes(searchTerm);
            const matchesVariant = a.variants?.some(v => v.toLowerCase().includes(searchTerm));
            const matchesSize = !sizeClass || a.sizeClass === sizeClass;
            const matchesOem = !oem || a.oem === oem;
            return (matchesPrimary || matchesVariant) && matchesSize && matchesOem;
        });

        /* SORTING */
        const dir = this.sortDirection === 'ASC' ? 1 : -1;
        const sortKey = (a: Aircraft) => (a as any)[this.sortColumn]?.toString().toLowerCase() || '';
        result.sort((a, b) => dir * sortKey(a).localeCompare(sortKey(b), undefined, {numeric: true, sensitivity: 'base'}));

        this.filterCache = {key, source: this.aircraft, result};
        return result;
    }

    setSort(column: string): void {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'ASC' ? 'DESC' : 'ASC';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'ASC';
        }
        this.pageIndex = 1;
    }

    get pagedAircraft(): Aircraft[] {
        const size = Number(this.pageSize);
        const start = (this.pageIndex - 1) * size;
        return this.filteredAircraft.slice(start, start + size);
    }

    get totalPages(): number {
        return Math.ceil(this.filteredAircraft.length / Number(this.pageSize)) || 1;
    }

    public setPage(page: number): void {
        if (page >= 1 && page <= this.totalPages) {
            this.pageIndex = page;
            window.scrollTo({top: 400, behavior: 'smooth'}); // Scroll to top of list
        }
    }

    public addVariant(event: any): void {
        const isEnter = event.key === 'Enter';
        const isComma = event.key === ',';

        if (isEnter || isComma) {
            event.preventDefault();
            const input = event.target as HTMLInputElement;
            const value = input.value.trim().replace(/,/g, '');


            /* TEST FOR VARIANT FROM SERVICE */
            if (value) {
                /* Check if the variant already exists on ANY aircraft. */
                const conflict = this.aircraft.find(a =>
                    a.id !== this.selectedId && // Don't conflict with itself if editing
                    a.variants?.some(v => v.toLowerCase() === value.toLowerCase())
                );

                if (conflict) {
                    this.duplicateConflict = conflict;
                    this.toastrService.warning(`Variant '${value}' is already assigned to ${conflict.type}`);
                    /*Stop here, don't add the pill*/
                    return;
                }

                /* Standard duplicate check for current form. */
                const currentVariants = this.aircraftForm.get('variants')?.value || [];
                if (!currentVariants.includes(value)) {
                    this.aircraftForm.patchValue({
                        variants: [...currentVariants, value]
                    });
                    /* Clear any old warnings. */
                    this.duplicateConflict = null;
                }
                input.value = '';
            }
        }
    }

    /**
     * Switch the modal context to edit the conflicting aircraft
     */
    public editConflictingAircraft(): void {
        if (this.duplicateConflict) {
            const target = this.duplicateConflict;
            this.closeModal(); // Close current session

            // Slight delay to allow modal animation to reset
            setTimeout(() => {
                this.editAircraft(target);
                this.duplicateConflict = null;
            }, 300);
        }
    }

    public removeVariant(index: number): void {
        const currentVariants = [...(this.aircraftForm.get('variants')?.value || [])];
        currentVariants.splice(index, 1);
        this.aircraftForm.patchValue({variants: currentVariants});
    }

    public openManageAircraftModal(): void {
        this.modalRef = this.modalService.open(this.manageAircraftModal,
            {size: 'xl', windowClass: 'manage-aircraft-modal', /*backdrop: 'static',*/ keyboard: false, container: 'body'});
    }

    public closeModal(): void {
        if (this.modalRef) {
            this.modalRef.close();
            this.onReset();
        }
    }

    ngOnDestroy(): void {
        this.destroyed$.next();
        this.destroyed$.complete();
    }

    @HostListener('window:scroll', [])
    onWindowScroll(): void {

        const pos = (document.documentElement.scrollTop || document.body.scrollTop) + document.documentElement.offsetHeight;
        const max = document.documentElement.scrollHeight;

        if (pos >= max - 10) {
            this.onScrollBottom();
        } else {
            this.hasScrolledToBottom$.next(false);
        }
    }

    private onScrollBottom(): void {
        if (this.pageIndex < this.totalPages) {
            this.hasScrolledToBottom$.next(true);
        }
    }

    public checkImage(evt: Event, string?: string) {
        const input = evt.target as HTMLInputElement;
        const imageValue = string || input.value;

        /* Use renderer to create a dummy image and check its width. */
        const img: HTMLImageElement = this.renderer.createElement('img');
        this.renderer.setAttribute(img, 'src', imageValue);

        let control;

        switch (input.id) {
            case 'image-input-1':
                control = this.aircraftForm.get('tuvoliExteriorImage');
                break;
            case 'image-input-2':
                control = this.aircraftForm.get('tuvoliInteriorImage1');
                break;
            case 'image-input-3':
                control = this.aircraftForm.get('tuvoliInteriorImage2');
                break;
        }

        if (img.naturalWidth === 0) {
            control?.markAsTouched();
            control?.setErrors({message: this.badImageText});
        }
    }

    /* One probe <img> per URL, reused across change-detection passes; naturalWidth fills in once it loads. */
    private imageProbes = new Map<string, HTMLImageElement>();

    public checkImageBySrc(inputValue: string): boolean {
        let img = this.imageProbes.get(inputValue);
        if (!img) {
            img = this.renderer.createElement('img') as HTMLImageElement;
            this.renderer.setAttribute(img, 'src', inputValue);
            this.imageProbes.set(inputValue, img);
        }
        return img.naturalWidth !== 0;
    }
}
